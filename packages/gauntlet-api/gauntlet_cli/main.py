"""Gauntlet CLI.

    gauntlet gate --agent-id my-agent --version 1.3.0 --fail-on-regression

Runs against a local gauntlet-api in dev (defaults to http://localhost:8000), or
against any URL via --api-url. Exits 0 on pass, 1 on regression.
"""
from __future__ import annotations

import json
import os
import pathlib
import sys

import click
import httpx


@click.group()
def cli() -> None:
    """Gauntlet — eval-as-CI/CD for AI agents."""


@cli.command()
@click.option("--agent-id", required=True)
@click.option("--version", "agent_version", required=True)
@click.option("--api-url", default=lambda: os.environ.get("GAUNTLET_API_URL", "http://localhost:8000"))
@click.option("--api-key", default=lambda: os.environ.get("GAUNTLET_API_KEY", ""))
@click.option("--fail-on-regression/--no-fail-on-regression", default=True)
@click.option("--concurrency", type=int, default=8)
@click.option("--report-out", type=click.Path(), default=None,
              help="Write the JSON report to a file (in addition to stdout).")
@click.option("--pr-comment-out", type=click.Path(), default=None,
              help="Write a markdown PR-comment summary to a file.")
def gate(
    agent_id: str,
    agent_version: str,
    api_url: str,
    api_key: str,
    fail_on_regression: bool,
    concurrency: int,
    report_out: str | None,
    pr_comment_out: str | None,
) -> None:
    """Run the deploy gate against a candidate agent version."""
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    body = {
        "agent_id": agent_id,
        "agent_version": agent_version,
        "fail_on_regression": fail_on_regression,
        "concurrency": concurrency,
    }

    try:
        r = httpx.post(f"{api_url}/v1/gate", json=body, headers=headers, timeout=120.0)
        r.raise_for_status()
        report = r.json()
    except httpx.HTTPError as e:
        click.echo(f"gate request failed: {e}", err=True)
        sys.exit(2)

    click.echo(json.dumps(report, indent=2))

    if report_out:
        pathlib.Path(report_out).write_text(json.dumps(report, indent=2))
    if pr_comment_out:
        # Render the markdown summary client-side so this works even when the
        # server-side rendering isn't exposed via HTTP.
        md = _render_markdown(report)
        pathlib.Path(pr_comment_out).write_text(md)

    sys.exit(int(report.get("exit_code", 0)))


@cli.command(name="post-pr-comment")
@click.option("--report-file", required=True, type=click.Path(exists=True))
@click.option("--repo", required=True, help="owner/name")
@click.option("--pr-number", required=True, type=int)
@click.option("--token", default=lambda: os.environ.get("GITHUB_TOKEN"))
def post_pr_comment(report_file: str, repo: str, pr_number: int, token: str | None) -> None:
    """Post the gate report as a PR comment."""
    if not token:
        click.echo("GITHUB_TOKEN not set", err=True)
        sys.exit(2)
    report = json.loads(pathlib.Path(report_file).read_text())
    md = _render_markdown(report)
    r = httpx.post(
        f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
        },
        json={"body": md},
        timeout=15.0,
    )
    r.raise_for_status()
    click.echo("posted PR comment ok")


def _render_markdown(report: dict) -> str:
    cost_sym = "▲" if report.get("cost_delta_usd", 0) > 0 else ("▼" if report.get("cost_delta_usd", 0) < 0 else "≈")
    lat_sym = "▲" if report.get("latency_delta_ms", 0) > 0 else ("▼" if report.get("latency_delta_ms", 0) < 0 else "≈")
    rows = []
    for r in (report.get("regressions") or [])[:25]:
        rows.append(f"| {r.get('cluster_tag')} | {str(r.get('eval_case_id'))[:8]} | {(r.get('rubric_summary') or '')[:60]} |")
    if not rows:
        rows = ["| — | — | _no regressions_ |"]

    return f"""## Gauntlet — agent `{report['agent_id']}` @ `{report['agent_version']}`

| Metric | Value |
| --- | --- |
| Pass rate | **{report['pass_rate']:.1%}** ({report['n_cases']} cases) |
| Regressions | **{report['n_regressions']}** |
| Cost | ${report['cost_usd']:.4f} ({cost_sym} ${report['cost_delta_usd']:+.4f}) |
| Latency p50 | {report['latency_p50_ms']}ms ({lat_sym} {report['latency_delta_ms']:+d}ms) |
| Corpus hash | `{report['corpus_hash'][:12]}…` |
| Cached | {"yes" if report.get('cached') else "no"} |

### Regressions

| cluster | case | rubric |
| --- | --- | --- |
{chr(10).join(rows)}

_Exit code: **{report.get('exit_code', 0)}**._
"""


if __name__ == "__main__":
    cli()
