'use client';

/**
 * RichTextEditor - TipTap-based rich text editor with commenting
 *
 * Features:
 * - @mention support
 * - Line-level commenting (highlight text to comment)
 * - Rich formatting (bold, italic, lists)
 * - Google Docs-like experience
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Mention from '@tiptap/extension-mention';
import { Box, Paper, IconButton, Tooltip, Popover, TextField, Button, Typography, Divider } from '@mui/material';
import {
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatListBulleted as BulletListIcon,
  FormatListNumbered as NumberedListIcon,
  Code as CodeIcon,
  AddComment as AddCommentIcon,
  Send as SendIcon,
} from '@mui/icons-material';

import { ILineComment, IUser } from '@wt-ros/common';
import { useAddLineComment } from '../hooks/useWorkItemMutation';

// ============================================
// TYPES
// ============================================

interface RichTextEditorProps {
  /** Initial content */
  content?: string;
  /** Update ID for linking comments */
  updateId?: string;
  /** Existing line comments */
  lineComments?: ILineComment[];
  /** Available users for mentions */
  users?: IUser[];
  /** Placeholder text */
  placeholder?: string;
  /** Whether the editor is editable */
  editable?: boolean;
  /** Callback when content changes */
  onChange?: (content: string) => void;
  /** Callback when a comment is added */
  onCommentAdded?: (comment: ILineComment) => void;
}

interface CommentPopoverState {
  anchorPosition: { top: number; left: number } | null;
  selectedText: string;
  startOffset: number;
  endOffset: number;
}

// ============================================
// MENTION SUGGESTION
// ============================================

const createMentionSuggestion = (users: IUser[]) => ({
  items: ({ query }: { query: string }) => {
    return users
      .filter((user) =>
        user.displayName.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 5);
  },
  render: () => {
    let component: HTMLDivElement | null = null;
    let selectedIndex = 0;

    return {
      onStart: (props: any) => {
        component = document.createElement('div');
        component.className = 'mention-suggestions';
        document.body.appendChild(component);
        updateSuggestions(props.items, props.command);
      },
      onUpdate: (props: any) => {
        updateSuggestions(props.items, props.command);
      },
      onKeyDown: (props: any) => {
        if (props.event.key === 'ArrowUp') {
          selectedIndex = Math.max(0, selectedIndex - 1);
          return true;
        }
        if (props.event.key === 'ArrowDown') {
          selectedIndex = Math.min(props.items.length - 1, selectedIndex + 1);
          return true;
        }
        if (props.event.key === 'Enter') {
          props.command(props.items[selectedIndex]);
          return true;
        }
        return false;
      },
      onExit: () => {
        component?.remove();
      },
    };

    function updateSuggestions(items: IUser[], command: (item: IUser) => void) {
      if (!component) return;
      component.innerHTML = items
        .map(
          (item, index) =>
            `<div class="mention-item ${index === selectedIndex ? 'selected' : ''}" data-index="${index}">
              @${item.displayName}
            </div>`
        )
        .join('');
    }
  },
});

// ============================================
// COMPONENT
// ============================================

export function RichTextEditor({
  content = '',
  updateId,
  lineComments = [],
  users = [],
  placeholder = 'Write your update...',
  editable = true,
  onChange,
  onCommentAdded,
}: RichTextEditorProps) {
  // Comment popover state
  const [commentPopover, setCommentPopover] = useState<CommentPopoverState>({
    anchorPosition: null,
    selectedText: '',
    startOffset: 0,
    endOffset: 0,
  });
  const [commentContent, setCommentContent] = useState('');

  // Mutations
  const addLineComment = useAddLineComment();

  // Editor setup
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: createMentionSuggestion(users),
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  // Handle text selection for commenting
  const handleMouseUp = useCallback(() => {
    if (!editor || !updateId) return;

    const { from, to } = editor.state.selection;
    if (from === to) return; // No selection

    const selectedText = editor.state.doc.textBetween(from, to);
    if (selectedText.trim().length === 0) return;

    // Get selection position for popover
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setCommentPopover({
      anchorPosition: {
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
      },
      selectedText,
      startOffset: from,
      endOffset: to,
    });
  }, [editor, updateId]);

  // Add click listener for commenting
  useEffect(() => {
    const editorElement = document.querySelector('.ProseMirror');
    if (editorElement) {
      editorElement.addEventListener('mouseup', handleMouseUp);
      return () => {
        editorElement.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [handleMouseUp]);

  // Handle adding a comment
  const handleAddComment = useCallback(async () => {
    if (!updateId || !commentContent.trim()) return;

    try {
      await addLineComment.mutateAsync({
        updateId,
        input: {
          startOffset: commentPopover.startOffset,
          endOffset: commentPopover.endOffset,
          content: commentContent,
        },
      });

      // Highlight the commented text
      editor
        ?.chain()
        .focus()
        .setTextSelection({
          from: commentPopover.startOffset,
          to: commentPopover.endOffset,
        })
        .toggleHighlight({ color: '#fef08a' })
        .run();

      // Reset
      setCommentPopover({
        anchorPosition: null,
        selectedText: '',
        startOffset: 0,
        endOffset: 0,
      });
      setCommentContent('');
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  }, [updateId, commentContent, commentPopover, editor, addLineComment]);

  // Close comment popover
  const handleCloseCommentPopover = useCallback(() => {
    setCommentPopover({
      anchorPosition: null,
      selectedText: '',
      startOffset: 0,
      endOffset: 0,
    });
    setCommentContent('');
  }, []);

  if (!editor) return null;

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Bubble Menu - appears on text selection */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 100 }}
        shouldShow={({ editor }) => {
          // Don't show if comment popover is open
          if (commentPopover.anchorPosition) return false;
          return !editor.state.selection.empty;
        }}
      >
        <Paper
          elevation={3}
          sx={{
            display: 'flex',
            gap: 0.5,
            p: 0.5,
            borderRadius: 1,
          }}
        >
          <Tooltip title="Bold (Cmd+B)">
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().toggleBold().run()}
              color={editor.isActive('bold') ? 'primary' : 'default'}
            >
              <BoldIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Italic (Cmd+I)">
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              color={editor.isActive('italic') ? 'primary' : 'default'}
            >
              <ItalicIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Code">
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().toggleCode().run()}
              color={editor.isActive('code') ? 'primary' : 'default'}
            >
              <CodeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {updateId && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <Tooltip title="Add Comment">
                <IconButton
                  size="small"
                  onClick={() => {
                    const { from, to } = editor.state.selection;
                    const selectedText = editor.state.doc.textBetween(from, to);
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                      const range = selection.getRangeAt(0);
                      const rect = range.getBoundingClientRect();
                      setCommentPopover({
                        anchorPosition: {
                          top: rect.bottom + window.scrollY,
                          left: rect.left + window.scrollX,
                        },
                        selectedText,
                        startOffset: from,
                        endOffset: to,
                      });
                    }
                  }}
                >
                  <AddCommentIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Paper>
      </BubbleMenu>

      {/* Floating Menu - appears on empty line */}
      <FloatingMenu
        editor={editor}
        tippyOptions={{ duration: 100 }}
        shouldShow={({ editor }) => {
          return (
            editor.isActive('paragraph') &&
            editor.state.selection.$from.parent.content.size === 0
          );
        }}
      >
        <Paper
          elevation={2}
          sx={{
            display: 'flex',
            gap: 0.5,
            p: 0.5,
            borderRadius: 1,
          }}
        >
          <Tooltip title="Bullet List">
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <BulletListIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Numbered List">
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <NumberedListIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Paper>
      </FloatingMenu>

      {/* Editor Content */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          minHeight: 150,
          '& .ProseMirror': {
            outline: 'none',
            minHeight: 120,
            '& p.is-editor-empty:first-child::before': {
              color: '#9ca3af',
              content: 'attr(data-placeholder)',
              float: 'left',
              height: 0,
              pointerEvents: 'none',
            },
            '& .mention': {
              backgroundColor: '#dbeafe',
              borderRadius: 4,
              padding: '2px 4px',
              color: '#1d4ed8',
              fontWeight: 500,
            },
            '& mark': {
              backgroundColor: '#fef08a',
              borderRadius: 2,
              padding: '0 2px',
              cursor: 'pointer',
            },
          },
        }}
      >
        <EditorContent editor={editor} />
      </Paper>

      {/* Comment Popover */}
      <Popover
        open={Boolean(commentPopover.anchorPosition)}
        anchorReference="anchorPosition"
        anchorPosition={commentPopover.anchorPosition ?? undefined}
        onClose={handleCloseCommentPopover}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 2, width: 300 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Comment on: "{commentPopover.selectedText.slice(0, 50)}
            {commentPopover.selectedText.length > 50 ? '...' : ''}"
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={2}
            size="small"
            placeholder="Add your comment..."
            value={commentContent}
            onChange={(e) => setCommentContent(e.target.value)}
            sx={{ mt: 1 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
            <Button size="small" onClick={handleCloseCommentPopover}>
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<SendIcon />}
              onClick={handleAddComment}
              disabled={!commentContent.trim() || addLineComment.isPending}
            >
              Comment
            </Button>
          </Box>
        </Box>
      </Popover>

      {/* Existing Comments Sidebar could go here */}
      {lineComments.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Comments ({lineComments.length})
          </Typography>
          {lineComments.map((comment) => (
            <Paper
              key={comment.id}
              variant="outlined"
              sx={{
                p: 1.5,
                mb: 1,
                backgroundColor: comment.resolved ? '#f9fafb' : '#fff',
              }}
            >
              <Typography variant="body2">{comment.content}</Typography>
              <Typography variant="caption" color="text.secondary">
                {comment.resolved ? '(Resolved)' : ''}
              </Typography>
            </Paper>
          ))}
        </Box>
      )}

      {/* Global Styles for Mention Suggestions */}
      <style jsx global>{`
        .mention-suggestions {
          position: absolute;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          padding: 4px;
          z-index: 1000;
        }
        .mention-item {
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
        }
        .mention-item:hover,
        .mention-item.selected {
          background-color: #f3f4f6;
        }
      `}</style>
    </Box>
  );
}

export default RichTextEditor;
