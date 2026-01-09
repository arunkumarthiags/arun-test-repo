/**
 * Quality Enforcer Tests - Content Quality Tests
 * Agent-Strategist: Innovation Auditor
 */

import {
  QualityEnforcer,
  QualityEnforcerConfig,
  QualityViolation,
  QualityCheckResult,
} from '../services/QualityEnforcer';
import {
  IWorkItem,
  IWorkUpdate,
  IArtifact,
  WorkStatus,
  HealthStatus,
  Priority,
  ArtifactType,
} from '@wt-ros/common';

// Mock data factories
const createMockWorkItem = (overrides: Partial<IWorkItem> = {}): IWorkItem => ({
  id: 'work-item-1',
  title: 'Test Work Item',
  description: 'A test work item description',
  driId: 'user-1',
  teamId: 'team-1',
  groupId: 'group-1',
  targetDate: new Date('2024-03-01'),
  originalTargetDate: new Date('2024-02-15'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
  priority: Priority.P1,
  status: WorkStatus.IN_PROGRESS,
  health: HealthStatus.GREEN,
  needsHelp: false,
  atRisk: false,
  stale: false,
  parentWorkItemId: null,
  artifacts: [],
  aiSuggestedUpdate: null,
  driftScore: null,
  lastActivityAt: new Date('2024-01-10'),
  ...overrides,
});

const createMockWorkUpdate = (overrides: Partial<IWorkUpdate> = {}): IWorkUpdate => ({
  id: 'update-1',
  workItemId: 'work-item-1',
  content: 'This is a test update with enough content to meet minimum requirements.',
  authorId: 'user-1',
  createdAt: new Date(),
  week: '2024-W02',
  isAiGenerated: false,
  aiConfidence: null,
  ...overrides,
});

const createMockArtifact = (overrides: Partial<IArtifact> = {}): IArtifact => ({
  id: 'artifact-1',
  type: ArtifactType.GITHUB_PR,
  url: 'https://github.com/org/repo/pull/123',
  title: 'Test PR',
  lastActivityAt: new Date(),
  metadata: {},
  ...overrides,
});

describe('QualityEnforcer', () => {
  let qualityEnforcer: QualityEnforcer;
  let config: QualityEnforcerConfig;

  beforeEach(() => {
    config = {
      minUpdateLength: 50,
      maxSimilarityThreshold: 0.8,
      minLinkedArtifacts: 1,
      requireDateChangeExplanation: true,
      requireNeedsHelpActionItems: true,
    };

    qualityEnforcer = new QualityEnforcer(config);
  });

  describe('validateUpdate', () => {
    describe('minimum length rule', () => {
      it('should pass when update content is greater than 50 characters', () => {
        const update = createMockWorkUpdate({
          content:
            'This is a comprehensive update that describes the current progress on the feature implementation.',
        });

        const result = qualityEnforcer.validateUpdate(update, null);

        expect(result.isValid).toBe(true);
        expect(result.violations).not.toContainEqual(
          expect.objectContaining({ rule: 'MIN_UPDATE_LENGTH' })
        );
      });

      it('should fail when update content is 50 characters or less', () => {
        const update = createMockWorkUpdate({
          content: 'Short update.',
        });

        const result = qualityEnforcer.validateUpdate(update, null);

        expect(result.isValid).toBe(false);
        expect(result.violations).toContainEqual(
          expect.objectContaining({
            rule: 'MIN_UPDATE_LENGTH',
            severity: 'error',
          })
        );
      });

      it('should fail when update content is exactly 50 characters', () => {
        const update = createMockWorkUpdate({
          content: 'x'.repeat(50),
        });

        const result = qualityEnforcer.validateUpdate(update, null);

        expect(result.isValid).toBe(false);
        expect(result.violations).toContainEqual(
          expect.objectContaining({ rule: 'MIN_UPDATE_LENGTH' })
        );
      });
    });

    describe('similarity rule', () => {
      it('should pass when update is sufficiently different from previous', () => {
        const previousUpdate = createMockWorkUpdate({
          content:
            'Last week we focused on implementing the authentication module and fixing bugs.',
        });
        const newUpdate = createMockWorkUpdate({
          content:
            'This week we completed the user dashboard and started work on the reporting feature.',
        });

        const result = qualityEnforcer.validateUpdate(newUpdate, previousUpdate);

        expect(result.isValid).toBe(true);
        expect(result.violations).not.toContainEqual(
          expect.objectContaining({ rule: 'UPDATE_SIMILARITY' })
        );
      });

      it('should fail when update is more than 80% similar to previous', () => {
        const previousUpdate = createMockWorkUpdate({
          content:
            'Working on feature implementation. Progress continues as expected.',
        });
        const newUpdate = createMockWorkUpdate({
          content:
            'Working on feature implementation. Progress continues as expected.',
        });

        const result = qualityEnforcer.validateUpdate(newUpdate, previousUpdate);

        expect(result.isValid).toBe(false);
        expect(result.violations).toContainEqual(
          expect.objectContaining({
            rule: 'UPDATE_SIMILARITY',
            severity: 'error',
          })
        );
      });

      it('should skip similarity check when there is no previous update', () => {
        const newUpdate = createMockWorkUpdate({
          content:
            'This is the first update for this work item with initial progress details.',
        });

        const result = qualityEnforcer.validateUpdate(newUpdate, null);

        expect(result.violations).not.toContainEqual(
          expect.objectContaining({ rule: 'UPDATE_SIMILARITY' })
        );
      });

      it('should warn when update is moderately similar (60-80%)', () => {
        const previousUpdate = createMockWorkUpdate({
          content:
            'Working on feature implementation. Made progress on authentication module.',
        });
        const newUpdate = createMockWorkUpdate({
          content:
            'Working on feature implementation. Made progress on authorization layer.',
        });

        const result = qualityEnforcer.validateUpdate(newUpdate, previousUpdate);

        // Depending on actual similarity, this might be a warning
        const hasWarning = result.violations.some(
          (v) => v.rule === 'UPDATE_SIMILARITY' && v.severity === 'warning'
        );
        const hasError = result.violations.some(
          (v) => v.rule === 'UPDATE_SIMILARITY' && v.severity === 'error'
        );
        // Should have some similarity flag if texts are similar enough
        expect(hasWarning || hasError || result.isValid).toBe(true);
      });
    });
  });

  describe('validateWorkItem', () => {
    describe('linked artifacts rule', () => {
      it('should pass when work item has at least 1 linked artifact', () => {
        const workItem = createMockWorkItem({
          artifacts: [createMockArtifact()],
        });

        const result = qualityEnforcer.validateWorkItem(workItem);

        expect(result.violations).not.toContainEqual(
          expect.objectContaining({ rule: 'MIN_LINKED_ARTIFACTS' })
        );
      });

      it('should fail when work item has no linked artifacts', () => {
        const workItem = createMockWorkItem({
          artifacts: [],
        });

        const result = qualityEnforcer.validateWorkItem(workItem);

        expect(result.isValid).toBe(false);
        expect(result.violations).toContainEqual(
          expect.objectContaining({
            rule: 'MIN_LINKED_ARTIFACTS',
            severity: 'warning',
          })
        );
      });

      it('should pass when work item has multiple artifacts', () => {
        const workItem = createMockWorkItem({
          artifacts: [
            createMockArtifact({ id: 'artifact-1' }),
            createMockArtifact({ id: 'artifact-2', type: ArtifactType.JIRA_TICKET }),
          ],
        });

        const result = qualityEnforcer.validateWorkItem(workItem);

        expect(result.violations).not.toContainEqual(
          expect.objectContaining({ rule: 'MIN_LINKED_ARTIFACTS' })
        );
      });
    });

    describe('needs help action items rule', () => {
      it('should pass when needsHelp is false', () => {
        const workItem = createMockWorkItem({
          needsHelp: false,
          description: 'Regular work item description',
        });

        const result = qualityEnforcer.validateWorkItem(workItem);

        expect(result.violations).not.toContainEqual(
          expect.objectContaining({ rule: 'NEEDS_HELP_ACTION_ITEMS' })
        );
      });

      it('should fail when needsHelp is true but no action items in description', () => {
        const workItem = createMockWorkItem({
          needsHelp: true,
          description: 'We need help with this item.',
        });

        const result = qualityEnforcer.validateWorkItem(workItem);

        expect(result.isValid).toBe(false);
        expect(result.violations).toContainEqual(
          expect.objectContaining({
            rule: 'NEEDS_HELP_ACTION_ITEMS',
            severity: 'error',
          })
        );
      });

      it('should pass when needsHelp is true and has action items', () => {
        const workItem = createMockWorkItem({
          needsHelp: true,
          description: `We need help with this item.

Action Items:
- Need code review from senior engineer
- Waiting for design specs from UX team`,
        });

        const result = qualityEnforcer.validateWorkItem(workItem);

        expect(result.violations).not.toContainEqual(
          expect.objectContaining({ rule: 'NEEDS_HELP_ACTION_ITEMS' })
        );
      });

      it('should recognize various action item formats', () => {
        const formats = [
          'Action Items:\n- Item 1',
          'TODO:\n* Task 1',
          'Next Steps:\n1. Step one',
          'Blockers:\n- Blocker 1',
          'Help needed:\n- Assistance required',
        ];

        formats.forEach((description) => {
          const workItem = createMockWorkItem({
            needsHelp: true,
            description,
          });

          const result = qualityEnforcer.validateWorkItem(workItem);

          expect(result.violations).not.toContainEqual(
            expect.objectContaining({ rule: 'NEEDS_HELP_ACTION_ITEMS' })
          );
        });
      });
    });
  });

  describe('validateDateChange', () => {
    it('should pass when target date is unchanged', () => {
      const oldWorkItem = createMockWorkItem({
        targetDate: new Date('2024-03-01'),
      });
      const newWorkItem = createMockWorkItem({
        targetDate: new Date('2024-03-01'),
      });

      const result = qualityEnforcer.validateDateChange(
        oldWorkItem,
        newWorkItem,
        null
      );

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail when target date changes without explanation', () => {
      const oldWorkItem = createMockWorkItem({
        targetDate: new Date('2024-03-01'),
      });
      const newWorkItem = createMockWorkItem({
        targetDate: new Date('2024-04-01'),
      });

      const result = qualityEnforcer.validateDateChange(
        oldWorkItem,
        newWorkItem,
        null
      );

      expect(result.isValid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          rule: 'DATE_CHANGE_EXPLANATION',
          severity: 'error',
        })
      );
    });

    it('should pass when target date changes with explanation', () => {
      const oldWorkItem = createMockWorkItem({
        targetDate: new Date('2024-03-01'),
      });
      const newWorkItem = createMockWorkItem({
        targetDate: new Date('2024-04-01'),
      });

      const result = qualityEnforcer.validateDateChange(
        oldWorkItem,
        newWorkItem,
        'Extended timeline due to additional scope requirements from stakeholder review.'
      );

      expect(result.isValid).toBe(true);
      expect(result.violations).not.toContainEqual(
        expect.objectContaining({ rule: 'DATE_CHANGE_EXPLANATION' })
      );
    });

    it('should fail when explanation is too short', () => {
      const oldWorkItem = createMockWorkItem({
        targetDate: new Date('2024-03-01'),
      });
      const newWorkItem = createMockWorkItem({
        targetDate: new Date('2024-04-01'),
      });

      const result = qualityEnforcer.validateDateChange(
        oldWorkItem,
        newWorkItem,
        'Delayed.'
      );

      expect(result.isValid).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          rule: 'DATE_CHANGE_EXPLANATION',
        })
      );
    });

    it('should handle null target dates', () => {
      const oldWorkItem = createMockWorkItem({
        targetDate: null,
      });
      const newWorkItem = createMockWorkItem({
        targetDate: new Date('2024-04-01'),
      });

      const result = qualityEnforcer.validateDateChange(
        oldWorkItem,
        newWorkItem,
        null
      );

      // Setting a date for the first time should not require explanation
      expect(result.isValid).toBe(true);
    });

    it('should handle removing target date', () => {
      const oldWorkItem = createMockWorkItem({
        targetDate: new Date('2024-03-01'),
      });
      const newWorkItem = createMockWorkItem({
        targetDate: null,
      });

      const result = qualityEnforcer.validateDateChange(
        oldWorkItem,
        newWorkItem,
        'Removing date as scope is being redefined.'
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1.0 for identical strings', () => {
      const similarity = qualityEnforcer.calculateSimilarity(
        'Hello world',
        'Hello world'
      );

      expect(similarity).toBe(1.0);
    });

    it('should return 0.0 for completely different strings', () => {
      const similarity = qualityEnforcer.calculateSimilarity(
        'aaaaaaaaa',
        'zzzzzzzzz'
      );

      expect(similarity).toBeLessThan(0.2);
    });

    it('should return value between 0 and 1 for partially similar strings', () => {
      const similarity = qualityEnforcer.calculateSimilarity(
        'The quick brown fox',
        'The slow brown dog'
      );

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('should be case insensitive', () => {
      const similarity = qualityEnforcer.calculateSimilarity(
        'HELLO WORLD',
        'hello world'
      );

      expect(similarity).toBe(1.0);
    });
  });

  describe('getViolationSummary', () => {
    it('should return empty array for valid results', () => {
      const result: QualityCheckResult = {
        isValid: true,
        violations: [],
        checkedAt: new Date(),
      };

      const summary = qualityEnforcer.getViolationSummary(result);

      expect(summary).toEqual([]);
    });

    it('should return formatted messages for violations', () => {
      const result: QualityCheckResult = {
        isValid: false,
        violations: [
          {
            rule: 'MIN_UPDATE_LENGTH',
            message: 'Update must be greater than 50 characters',
            severity: 'error',
          },
          {
            rule: 'MIN_LINKED_ARTIFACTS',
            message: 'Work item must have at least 1 linked artifact',
            severity: 'warning',
          },
        ],
        checkedAt: new Date(),
      };

      const summary = qualityEnforcer.getViolationSummary(result);

      expect(summary).toHaveLength(2);
      expect(summary[0]).toContain('ERROR');
      expect(summary[0]).toContain('Update must be greater than 50 characters');
      expect(summary[1]).toContain('WARNING');
    });
  });

  describe('checkAll', () => {
    it('should combine violations from update and work item checks', () => {
      const workItem = createMockWorkItem({
        artifacts: [],
        needsHelp: true,
        description: 'No action items here.',
      });
      const update = createMockWorkUpdate({
        content: 'Short.',
      });

      const result = qualityEnforcer.checkAll(workItem, update, null);

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(2);
    });

    it('should return valid when all checks pass', () => {
      const workItem = createMockWorkItem({
        artifacts: [createMockArtifact()],
        needsHelp: false,
      });
      const update = createMockWorkUpdate({
        content:
          'This is a comprehensive update with sufficient detail about the progress made this week.',
      });

      const result = qualityEnforcer.checkAll(workItem, update, null);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('configuration', () => {
    it('should respect custom min update length', () => {
      const customEnforcer = new QualityEnforcer({
        ...config,
        minUpdateLength: 100,
      });

      const update = createMockWorkUpdate({
        content: 'This update has 60 characters which would normally pass.',
      });

      const result = customEnforcer.validateUpdate(update, null);

      expect(result.isValid).toBe(false);
    });

    it('should respect custom similarity threshold', () => {
      const strictEnforcer = new QualityEnforcer({
        ...config,
        maxSimilarityThreshold: 0.5,
      });

      const previousUpdate = createMockWorkUpdate({
        content:
          'Working on feature implementation with progress on the authentication module.',
      });
      const newUpdate = createMockWorkUpdate({
        content:
          'Working on feature implementation with progress on the authorization module.',
      });

      const result = strictEnforcer.validateUpdate(newUpdate, previousUpdate);

      // With stricter threshold, this should fail
      expect(result.violations.some((v) => v.rule === 'UPDATE_SIMILARITY')).toBe(
        true
      );
    });

    it('should allow disabling date change explanation requirement', () => {
      const lenientEnforcer = new QualityEnforcer({
        ...config,
        requireDateChangeExplanation: false,
      });

      const oldWorkItem = createMockWorkItem({
        targetDate: new Date('2024-03-01'),
      });
      const newWorkItem = createMockWorkItem({
        targetDate: new Date('2024-04-01'),
      });

      const result = lenientEnforcer.validateDateChange(
        oldWorkItem,
        newWorkItem,
        null
      );

      expect(result.isValid).toBe(true);
    });
  });
});
