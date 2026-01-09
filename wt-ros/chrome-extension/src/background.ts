/**
 * WT-ROS Chrome Extension - Background Service Worker
 * Handles context menus, badge updates, and API communication
 */

import { ArtifactType, IWorkItem, HealthStatus, WorkStatus } from '@wt-ros/common';

// API configuration
const API_BASE_URL = 'http://localhost:4000/graphql';

/**
 * Types for messaging between extension components
 */
interface LinkArtifactMessage {
  type: 'LINK_ARTIFACT';
  payload: {
    workItemId: string;
    url: string;
    title: string;
    artifactType: ArtifactType;
  };
}

interface GetWorkItemsMessage {
  type: 'GET_WORK_ITEMS';
  payload: {
    searchQuery?: string;
    limit?: number;
  };
}

interface GetLinkedWorkItemMessage {
  type: 'GET_LINKED_WORK_ITEM';
  payload: {
    url: string;
  };
}

interface UpdateBadgeMessage {
  type: 'UPDATE_BADGE';
  payload: {
    tabId: number;
    workItem?: IWorkItem;
  };
}

type ExtensionMessage =
  | LinkArtifactMessage
  | GetWorkItemsMessage
  | GetLinkedWorkItemMessage
  | UpdateBadgeMessage;

/**
 * Storage keys
 */
const STORAGE_KEYS = {
  API_TOKEN: 'wt_ros_api_token',
  LINKED_URLS: 'wt_ros_linked_urls',
  RECENT_WORK_ITEMS: 'wt_ros_recent_items',
};

/**
 * Detect artifact type from URL
 */
function detectArtifactType(url: string): ArtifactType {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('jira') || urlLower.includes('atlassian.net/browse')) {
    return ArtifactType.JIRA_TICKET;
  }
  if (urlLower.includes('github.com') && urlLower.includes('/pull/')) {
    return ArtifactType.GITHUB_PR;
  }
  if (urlLower.includes('github.com') && urlLower.includes('/issues/')) {
    return ArtifactType.GITHUB_ISSUE;
  }
  if (urlLower.includes('slack.com')) {
    return ArtifactType.SLACK_THREAD;
  }
  if (urlLower.includes('docs.google.com')) {
    return ArtifactType.GOOGLE_DOC;
  }
  if (urlLower.includes('confluence') || urlLower.includes('atlassian.net/wiki')) {
    return ArtifactType.CONFLUENCE_PAGE;
  }
  if (urlLower.includes('figma.com')) {
    return ArtifactType.FIGMA_FILE;
  }

  // Default to Google Doc for unknown
  return ArtifactType.GOOGLE_DOC;
}

/**
 * Get badge color based on health status
 */
function getBadgeColor(health: HealthStatus): string {
  switch (health) {
    case HealthStatus.GREEN:
      return '#22c55e';
    case HealthStatus.YELLOW:
      return '#eab308';
    case HealthStatus.RED:
      return '#ef4444';
    default:
      return '#6b7280';
  }
}

/**
 * Get badge text based on status
 */
function getBadgeText(status: WorkStatus): string {
  switch (status) {
    case WorkStatus.IN_PROGRESS:
      return 'WIP';
    case WorkStatus.BLOCKED:
      return 'BLK';
    case WorkStatus.COMPLETE:
      return 'DONE';
    case WorkStatus.CANCELLED:
      return 'X';
    default:
      return 'NEW';
  }
}

/**
 * GraphQL request helper
 */
async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const storage = await chrome.storage.local.get(STORAGE_KEYS.API_TOKEN);
  const token = storage[STORAGE_KEYS.API_TOKEN] || '';

  const response = await fetch(API_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  const result = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (result.errors && result.errors.length > 0) {
    throw new Error(result.errors.map((e) => e.message).join(', '));
  }

  return result.data as T;
}

/**
 * Link artifact to work item
 */
async function linkArtifact(
  workItemId: string,
  url: string,
  title: string,
  type: ArtifactType
): Promise<void> {
  const query = `
    mutation LinkArtifact($workItemId: ID!, $artifact: ArtifactInput!) {
      linkArtifact(workItemId: $workItemId, artifact: $artifact) {
        id
        url
        type
        title
      }
    }
  `;

  await graphqlRequest(query, {
    workItemId,
    artifact: { url, type, title },
  });

  // Store the link locally for quick lookup
  const storage = await chrome.storage.local.get(STORAGE_KEYS.LINKED_URLS);
  const linkedUrls = storage[STORAGE_KEYS.LINKED_URLS] || {};
  linkedUrls[url] = workItemId;
  await chrome.storage.local.set({ [STORAGE_KEYS.LINKED_URLS]: linkedUrls });
}

/**
 * Get work items for search
 */
async function getWorkItems(
  searchQuery?: string,
  limit = 20
): Promise<IWorkItem[]> {
  const query = `
    query GetWorkItems($filters: WorkItemFilters, $pagination: PaginationInput) {
      workItems(filters: $filters, pagination: $pagination) {
        edges {
          node {
            id
            title
            description
            priority
            status
            health
            groupId
            driId
          }
        }
      }
    }
  `;

  const result = await graphqlRequest<{
    workItems: {
      edges: Array<{ node: IWorkItem }>;
    };
  }>(query, {
    filters: searchQuery ? { searchQuery } : {},
    pagination: { limit },
  });

  return result.workItems.edges.map((edge) => edge.node);
}

/**
 * Get work item linked to a URL
 */
async function getLinkedWorkItem(url: string): Promise<IWorkItem | null> {
  // First check local storage
  const storage = await chrome.storage.local.get(STORAGE_KEYS.LINKED_URLS);
  const linkedUrls = storage[STORAGE_KEYS.LINKED_URLS] || {};
  const workItemId = linkedUrls[url];

  if (!workItemId) {
    return null;
  }

  const query = `
    query GetWorkItem($id: ID!) {
      workItem(id: $id) {
        id
        title
        description
        priority
        status
        health
        groupId
        driId
        needsHelp
        atRisk
      }
    }
  `;

  try {
    const result = await graphqlRequest<{ workItem: IWorkItem | null }>(query, {
      id: workItemId,
    });
    return result.workItem;
  } catch {
    return null;
  }
}

/**
 * Update badge for tab
 */
async function updateBadge(tabId: number, url: string): Promise<void> {
  try {
    const workItem = await getLinkedWorkItem(url);

    if (workItem) {
      await chrome.action.setBadgeText({ tabId, text: getBadgeText(workItem.status) });
      await chrome.action.setBadgeBackgroundColor({
        tabId,
        color: getBadgeColor(workItem.health),
      });
      await chrome.action.setTitle({
        tabId,
        title: `WT-ROS: ${workItem.title}\nStatus: ${workItem.status}\nHealth: ${workItem.health}`,
      });
    } else {
      await chrome.action.setBadgeText({ tabId, text: '' });
      await chrome.action.setTitle({ tabId, title: 'WT-ROS Work Tracker' });
    }
  } catch (error) {
    console.error('Error updating badge:', error);
    await chrome.action.setBadgeText({ tabId, text: '' });
  }
}

/**
 * Create context menus on install
 */
chrome.runtime.onInstalled.addListener(() => {
  // Create parent context menu
  chrome.contextMenus.create({
    id: 'wt-ros-menu',
    title: 'WT-ROS',
    contexts: ['page', 'link'],
  });

  // Create "Link to Work Item" submenu
  chrome.contextMenus.create({
    id: 'wt-ros-link',
    parentId: 'wt-ros-menu',
    title: 'Link to Work Item...',
    contexts: ['page', 'link'],
  });

  // Create "Quick Link" submenu for recently used work items
  chrome.contextMenus.create({
    id: 'wt-ros-quick-link',
    parentId: 'wt-ros-menu',
    title: 'Quick Link',
    contexts: ['page', 'link'],
  });

  // Create "View Linked Work Item" option
  chrome.contextMenus.create({
    id: 'wt-ros-view',
    parentId: 'wt-ros-menu',
    title: 'View Linked Work Item',
    contexts: ['page'],
  });

  console.log('WT-ROS context menus created');
});

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !tab.url) return;

  const url = info.linkUrl || info.pageUrl || tab.url;
  const title = tab.title || url;

  switch (info.menuItemId) {
    case 'wt-ros-link':
      // Open popup for work item selection
      await chrome.action.openPopup();
      // Send message to popup with URL context
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'CONTEXT_MENU_LINK',
          payload: { url, title, artifactType: detectArtifactType(url) },
        });
      }, 500);
      break;

    case 'wt-ros-view':
      const workItem = await getLinkedWorkItem(url);
      if (workItem) {
        // Open work item in WT-ROS web app
        chrome.tabs.create({
          url: `http://localhost:3000/work-items/${workItem.id}`,
        });
      } else {
        // Show notification that no work item is linked
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'public/icons/icon48.png',
          title: 'WT-ROS',
          message: 'No work item is linked to this page.',
        });
      }
      break;
  }
});

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'LINK_ARTIFACT': {
          const { workItemId, url, title, artifactType } = message.payload;
          await linkArtifact(workItemId, url, title, artifactType);

          // Update recent work items
          const storage = await chrome.storage.local.get(STORAGE_KEYS.RECENT_WORK_ITEMS);
          const recentItems: string[] = storage[STORAGE_KEYS.RECENT_WORK_ITEMS] || [];
          const updatedRecent = [
            workItemId,
            ...recentItems.filter((id) => id !== workItemId),
          ].slice(0, 5);
          await chrome.storage.local.set({
            [STORAGE_KEYS.RECENT_WORK_ITEMS]: updatedRecent,
          });

          // Update badge on active tab
          const [activeTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (activeTab?.id && activeTab.url) {
            await updateBadge(activeTab.id, activeTab.url);
          }

          sendResponse({ success: true });
          break;
        }

        case 'GET_WORK_ITEMS': {
          const { searchQuery, limit } = message.payload;
          const items = await getWorkItems(searchQuery, limit);
          sendResponse({ success: true, data: items });
          break;
        }

        case 'GET_LINKED_WORK_ITEM': {
          const { url } = message.payload;
          const workItem = await getLinkedWorkItem(url);
          sendResponse({ success: true, data: workItem });
          break;
        }

        case 'UPDATE_BADGE': {
          const { tabId, workItem } = message.payload;
          if (workItem) {
            await chrome.action.setBadgeText({
              tabId,
              text: getBadgeText(workItem.status),
            });
            await chrome.action.setBadgeBackgroundColor({
              tabId,
              color: getBadgeColor(workItem.health),
            });
          } else {
            await chrome.action.setBadgeText({ tabId, text: '' });
          }
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })();

  // Return true to indicate async response
  return true;
});

/**
 * Update badge when tab is activated
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    await updateBadge(activeInfo.tabId, tab.url);
  }
});

/**
 * Update badge when tab URL changes
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    await updateBadge(tabId, tab.url);
  }
});

console.log('WT-ROS Background Service Worker initialized');
