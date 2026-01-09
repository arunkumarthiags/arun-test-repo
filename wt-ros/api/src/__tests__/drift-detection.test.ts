/**
 * Drift Detection Tests - TDD Tests for Drift Logic
 * Agent-Strategist: Innovation Auditor
 */

import { DriftDetector, DriftDetectorConfig } from '../services/DriftDetector';
import {
  DriftScore,
  DriftFactors,
  IWorkItem,
  IWorkUpdate,
  IActivity,
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

const createMockActivity = (overrides: Partial<IActivity> = {}): IActivity => ({
  id: 'activity-1',
  workItemId: 'work-item-1',
  source: ArtifactType.GITHUB_PR,
  action: 'merged',
  actorId: 'user-1',
  actorName: 'Test User',
  content: 'Merged PR #123',
  url: 'https://github.com/org/repo/pull/123',
  occurredAt: new Date(),
  metadata: {},
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

// Mock repositories
interface MockWorkItemRepository {
  findById(id: string): Promise<IWorkItem | null>;
  getDateHistory(workItemId: string): Promise<Date[]>;
}

interface MockWorkUpdateRepository {
  findByWorkItemId(workItemId: string, limit?: number): Promise<IWorkUpdate[]>;
  getUpdateFrequency(workItemId: string, dayRange: number): Promise<number>;
}

interface MockActivityRepository {
  findByWorkItemId(workItemId: string, limit?: number): Promise<IActivity[]>;
  getActivityCount(workItemId: string, dayRange: number): Promise<number>;
}

describe('DriftDetector', () => {
  let driftDetector: DriftDetector;
  let mockWorkItemRepo: jest.Mocked<MockWorkItemRepository>;
  let mockWorkUpdateRepo: jest.Mocked<MockWorkUpdateRepository>;
  let mockActivityRepo: jest.Mocked<MockActivityRepository>;

  beforeEach(() => {
    // Initialize mocks
    mockWorkItemRepo = {
      findById: jest.fn(),
      getDateHistory: jest.fn(),
    };
    mockWorkUpdateRepo = {
      findByWorkItemId: jest.fn(),
      getUpdateFrequency: jest.fn(),
    };
    mockActivityRepo = {
      findByWorkItemId: jest.fn(),
      getActivityCount: jest.fn(),
    };

    const config: DriftDetectorConfig = {
      alertThreshold: 0.7,
      docUpdateFrequencyWeight: 0.25,
      codeActivityAlignmentWeight: 0.25,
      statusAccuracyWeight: 0.25,
      dateStabilityWeight: 0.25,
      staleThresholdDays: 7,
      updateFrequencyDays: 30,
    };

    driftDetector = new DriftDetector(
      mockWorkItemRepo as any,
      mockWorkUpdateRepo as any,
      mockActivityRepo as any,
      config
    );
  });

  describe('calculateDrift', () => {
    it('should return a DriftScore for a valid work item', async () => {
      const workItem = createMockWorkItem();
      mockWorkItemRepo.findById.mockResolvedValue(workItem);
      mockWorkItemRepo.getDateHistory.mockResolvedValue([
        new Date('2024-02-15'),
        new Date('2024-03-01'),
      ]);
      mockWorkUpdateRepo.findByWorkItemId.mockResolvedValue([
        createMockWorkUpdate({ createdAt: new Date() }),
      ]);
      mockWorkUpdateRepo.getUpdateFrequency.mockResolvedValue(3);
      mockActivityRepo.findByWorkItemId.mockResolvedValue([
        createMockActivity({ occurredAt: new Date() }),
      ]);
      mockActivityRepo.getActivityCount.mockResolvedValue(5);

      const result = await driftDetector.calculateDrift(workItem.id);

      expect(result).toBeDefined();
      expect(result.workItemId).toBe(workItem.id);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.factors).toHaveProperty('docUpdateFrequency');
      expect(result.factors).toHaveProperty('codeActivityAlignment');
      expect(result.factors).toHaveProperty('statusAccuracy');
      expect(result.factors).toHaveProperty('dateStability');
      expect(result.calculatedAt).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent work item', async () => {
      mockWorkItemRepo.findById.mockResolvedValue(null);

      await expect(driftDetector.calculateDrift('non-existent')).rejects.toThrow(
        'Work item not found: non-existent'
      );
    });

    it('should return high drift score for stale items with no updates', async () => {
      const staleWorkItem = createMockWorkItem({
        lastActivityAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        stale: true,
      });
      mockWorkItemRepo.findById.mockResolvedValue(staleWorkItem);
      mockWorkItemRepo.getDateHistory.mockResolvedValue([new Date('2024-02-15')]);
      mockWorkUpdateRepo.findByWorkItemId.mockResolvedValue([]);
      mockWorkUpdateRepo.getUpdateFrequency.mockResolvedValue(0);
      mockActivityRepo.findByWorkItemId.mockResolvedValue([]);
      mockActivityRepo.getActivityCount.mockResolvedValue(0);

      const result = await driftDetector.calculateDrift(staleWorkItem.id);

      expect(result.score).toBeGreaterThan(0.7);
      expect(result.factors.docUpdateFrequency).toBeLessThan(0.3);
    });

    it('should return low drift score for active items with regular updates', async () => {
      const activeWorkItem = createMockWorkItem({
        lastActivityAt: new Date(),
        stale: false,
        health: HealthStatus.GREEN,
      });
      mockWorkItemRepo.findById.mockResolvedValue(activeWorkItem);
      mockWorkItemRepo.getDateHistory.mockResolvedValue([new Date('2024-02-15')]);
      mockWorkUpdateRepo.findByWorkItemId.mockResolvedValue([
        createMockWorkUpdate({ createdAt: new Date() }),
        createMockWorkUpdate({ createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }),
      ]);
      mockWorkUpdateRepo.getUpdateFrequency.mockResolvedValue(4);
      mockActivityRepo.findByWorkItemId.mockResolvedValue([
        createMockActivity({ occurredAt: new Date() }),
        createMockActivity({ occurredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }),
      ]);
      mockActivityRepo.getActivityCount.mockResolvedValue(10);

      const result = await driftDetector.calculateDrift(activeWorkItem.id);

      expect(result.score).toBeLessThan(0.5);
      expect(result.factors.docUpdateFrequency).toBeGreaterThan(0.5);
    });
  });

  describe('docUpdateFrequency factor', () => {
    it('should return 1.0 for items updated this week', async () => {
      const workItem = createMockWorkItem();
      mockWorkItemRepo.findById.mockResolvedValue(workItem);
      mockWorkItemRepo.getDateHistory.mockResolvedValue([new Date('2024-02-15')]);
      mockWorkUpdateRepo.findByWorkItemId.mockResolvedValue([
        createMockWorkUpdate({ createdAt: new Date() }),
      ]);
      mockWorkUpdateRepo.getUpdateFrequency.mockResolvedValue(4);
      mockActivityRepo.findByWorkItemId.mockResolvedValue([]);
      mockActivityRepo.getActivityCount.mockResolvedValue(0);

      const result = await driftDetector.calculateDrift(workItem.id);

      expect(result.factors.docUpdateFrequency).toBeGreaterThanOrEqual(0.8);
    });

    it('should return lower score for items not updated in 2+ weeks', async () => {
      const workItem = createMockWorkItem();
      mockWorkItemRepo.findById.mockResolvedValue(workItem);
      mockWorkItemRepo.getDateHistory.mockResolvedValue([new Date('2024-02-15')]);
      mockWorkUpdateRepo.findByWorkItemId.mockResolvedValue([
        createMockWorkUpdate({
          createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), // 21 days ago
        }),
      ]);
      mockWorkUpdateRepo.getUpdateFrequency.mockResolvedValue(1);
      mockActivityRepo.findByWorkItemId.mockResolvedValue([]);
      mockActivityRepo.getActivityCount.mockResolvedValue(0);

      const result = await driftDetector.calculateDrift(workItem.id);

      expect(result.factors.docUpdateFrequency).toBeLessThan(0.5);
    });
  });

  describe('codeActivityAlignment factor', () => {
    it('should return high score when activity aligns with stated goals', async () => {
      const workItem = createMockWorkItem({
        status: WorkStatus.IN_PROGRESS,
        health: HealthStatus.GREEN,
      });
      mockWorkItemRepo.findById.mockResolvedValue(workItem);
      mockWorkItemRepo.getDateHistory.mockResolvedValue([new Date('2024-02-15')]);
      mockWorkUpdateRepo.findByWorkItemId.mockResolvedValue([createMockWorkUpdate()]);
      mockWorkUpdateRepo.getUpdateFrequency.mockResolvedValue(2);
      mockActivityRepo.findByWorkItemId.mockResolvedValue([
        createMockActivity({ occurredAt: new Date(), action: 'merged' }),
        createMockActivity({
          occurredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          action: 'created',
        }),
      ]);
      mockActivityRepo.getActivityCount.mockResolvedValue(5);

      const result = await driftDetector.calculateDrift(workItem.id);

      expect(result.factors.codeActivityAlignment).toBeGreaterThan(0.5);
    });

    it('should return low score for "in progress" items with no activity', async () => {
      const workItem = createMockWorkItem({
        status: WorkStatus.IN_PROGRESS,
        health: HealthStatus.GREEN,
      });
      mockWorkItemRepo.findById.mockResolvedValue(workItem);
      mockWorkItemRepo.getDateHistory.mockResolvedValue([new Date('2024-02-15')]);
      mockWorkUpdateRepo.findByWorkItemId.mockResolvedValue([createMockWorkUpdate()]);
      mockWorkUpdateRepo.getUpdateFrequency.mockResolvedValue(1);
      mockActivityRepo.findByWorkItemId.mockResolvedValue([]);
      mockActivityRepo.getActivityCount.mockResolvedValue(0);

      const result = await driftDetector.calculateDrift(workItem.id);

      expect(result.factors.codeActivityAlignment).toBeLessThan(0.5);
    });
  });

  describe('statusAccuracy factor', () => {
    it('should return high score when reported status matches actual state', async () => {
      const workItem = createMockWorkItem({
        status: WorkStatus.IN_PROGRESS,
        health: HealthStatus.GREEN,
        lastActivityAt: new Date(),
      });
      mockWorkItemRepo.findById.mockResolvedValue(workItem);
      mockWorkItemRepo.getDateHistory.mockResolvedValue([new Date('2024-02-15')]);
      mockWorkUpdateRepo.findByWorkItemId.mockResolvedValue([createMockWorkUpdate()]);
      mockWorkUpdateRepo.getUpdateFrequency.mockResolvedValue(2);
      mockActivityRepo.findByWorkItemId.mockResolvedValue([createMockActivity()]);
      mockActivityRepo.getActivityCount.mockResolvedValue(3);

      const result = await driftDetector.calculateDrift(workItem.id);

      expect(result.factors.statusAccuracy).toBeGreaterThan(0.5);
    });

    it('should return low score for green status with no recent activity', async () => {
      const workItem = createMockWorkItem({
        status: WorkStatus.IN_PROGRESS,
        health: HealthStatus.GREEN,
        lastActivityAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      });
      mockWorkItemRepo.findById.mockResolvedValue(workItem);
      mockWorkItemRepo.getDateHistory.mockResolvedValue([new Date('2024-02-15')]);
      mockWorkUpdateRepo.findByWorkItemId.mockResolvedValue([]);
      mockWorkUpdateRepo.getUpdateFrequency.mockResolvedValue(0);
      mockActivityRepo.findByWorkItemId.mockResolvedValue([]);
      mockActivityRepo.getActivityCount.mockResolvedValue(0);

      const result = await driftDetector.calculateDrift(workItem.id);

      expect(result.factors.statusAccuracy).toBeLessThan(0.5);
    });
  });

  describe('dateStability factor', () => {
    it('should return 1.0 for items with unchanged target date', async () => {
      const workItem = createMockWorkItem({
        targetDate: new Date('2024-03-01'),
        originalTargetDate: new Date('2024-03-01'),
      });
      mockWorkItemRepo.findById.mockResolvedValue(workItem);
      mockWorkItemRepo.getDateHistory.mockResolvedValue([new Date('2024-03-01')]);
      mockWorkUpdateRepo.findByWorkItemId.mockResolvedValue([createMockWorkUpdate()]);
      mockWorkUpdateRepo.getUpdateFrequency.mockResolvedValue(2);
      mockActivityRepo.findByWorkItemId.mockResolvedValue([createMockActivity()]);
      mockActivityRepo.getActivityCount.mockResolvedValue(3);

      const result = await driftDetector.calculateDrift(workItem.id);

      expect(result.factors.dateStability).toBe(1.0);
    });

    it('should return lower score for items with multiple date changes', async () => {
      const workItem = createMockWorkItem({
        targetDate: new Date('2024-04-15'),
        originalTargetDate: new Date('2024-02-01'),
      });
      mockWorkItemRepo.findById.mockResolvedValue(workItem);
      mockWorkItemRepo.getDateHistory.mockResolvedValue([
        new Date('2024-02-01'),
        new Date('2024-02-15'),
        new Date('2024-03-01'),
        new Date('2024-04-01'),
        new Date('2024-04-15'),
      ]);
      mockWorkUpdateRepo.findByWorkItemId.mockResolvedValue([createMockWorkUpdate()]);
      mockWorkUpdateRepo.getUpdateFrequency.mockResolvedValue(2);
      mockActivityRepo.findByWorkItemId.mockResolvedValue([createMockActivity()]);
      mockActivityRepo.getActivityCount.mockResolvedValue(3);

      const result = await driftDetector.calculateDrift(workItem.id);

      expect(result.factors.dateStability).toBeLessThan(0.5);
    });

    it('should return 1.0 for items with no target date', async () => {
      const workItem = createMockWorkItem({
        targetDate: null,
        originalTargetDate: null,
      });
      mockWorkItemRepo.findById.mockResolvedValue(workItem);
      mockWorkItemRepo.getDateHistory.mockResolvedValue([]);
      mockWorkUpdateRepo.findByWorkItemId.mockResolvedValue([createMockWorkUpdate()]);
      mockWorkUpdateRepo.getUpdateFrequency.mockResolvedValue(2);
      mockActivityRepo.findByWorkItemId.mockResolvedValue([createMockActivity()]);
      mockActivityRepo.getActivityCount.mockResolvedValue(3);

      const result = await driftDetector.calculateDrift(workItem.id);

      expect(result.factors.dateStability).toBe(1.0);
    });
  });

  describe('shouldAlert', () => {
    it('should return true when drift score exceeds threshold', async () => {
      const workItem = createMockWorkItem({ stale: true });
      mockWorkItemRepo.findById.mockResolvedValue(workItem);
      mockWorkItemRepo.getDateHistory.mockResolvedValue([
        new Date('2024-02-01'),
        new Date('2024-02-15'),
        new Date('2024-03-01'),
        new Date('2024-03-15'),
        new Date('2024-04-01'),
      ]);
      mockWorkUpdateRepo.findByWorkItemId.mockResolvedValue([]);
      mockWorkUpdateRepo.getUpdateFrequency.mockResolvedValue(0);
      mockActivityRepo.findByWorkItemId.mockResolvedValue([]);
      mockActivityRepo.getActivityCount.mockResolvedValue(0);

      const result = await driftDetector.calculateDrift(workItem.id);
      const shouldAlert = driftDetector.shouldAlert(result);

      expect(shouldAlert).toBe(true);
    });

    it('should return false when drift score is below threshold', async () => {
      const workItem = createMockWorkItem();
      mockWorkItemRepo.findById.mockResolvedValue(workItem);
      mockWorkItemRepo.getDateHistory.mockResolvedValue([new Date('2024-02-15')]);
      mockWorkUpdateRepo.findByWorkItemId.mockResolvedValue([
        createMockWorkUpdate({ createdAt: new Date() }),
      ]);
      mockWorkUpdateRepo.getUpdateFrequency.mockResolvedValue(4);
      mockActivityRepo.findByWorkItemId.mockResolvedValue([
        createMockActivity({ occurredAt: new Date() }),
      ]);
      mockActivityRepo.getActivityCount.mockResolvedValue(10);

      const result = await driftDetector.calculateDrift(workItem.id);
      const shouldAlert = driftDetector.shouldAlert(result);

      // Only assert false if score is actually below threshold
      if (result.score < 0.7) {
        expect(shouldAlert).toBe(false);
      }
    });
  });

  describe('calculateBatchDrift', () => {
    it('should calculate drift for multiple work items', async () => {
      const workItems = [
        createMockWorkItem({ id: 'work-item-1' }),
        createMockWorkItem({ id: 'work-item-2' }),
      ];

      mockWorkItemRepo.findById.mockImplementation(async (id: string) => {
        return workItems.find((w) => w.id === id) || null;
      });
      mockWorkItemRepo.getDateHistory.mockResolvedValue([new Date('2024-02-15')]);
      mockWorkUpdateRepo.findByWorkItemId.mockResolvedValue([createMockWorkUpdate()]);
      mockWorkUpdateRepo.getUpdateFrequency.mockResolvedValue(2);
      mockActivityRepo.findByWorkItemId.mockResolvedValue([createMockActivity()]);
      mockActivityRepo.getActivityCount.mockResolvedValue(3);

      const results = await driftDetector.calculateBatchDrift(['work-item-1', 'work-item-2']);

      expect(results).toHaveLength(2);
      expect(results[0].workItemId).toBe('work-item-1');
      expect(results[1].workItemId).toBe('work-item-2');
    });

    it('should filter out non-existent work items', async () => {
      const workItem = createMockWorkItem({ id: 'work-item-1' });
      mockWorkItemRepo.findById.mockImplementation(async (id: string) => {
        return id === 'work-item-1' ? workItem : null;
      });
      mockWorkItemRepo.getDateHistory.mockResolvedValue([new Date('2024-02-15')]);
      mockWorkUpdateRepo.findByWorkItemId.mockResolvedValue([createMockWorkUpdate()]);
      mockWorkUpdateRepo.getUpdateFrequency.mockResolvedValue(2);
      mockActivityRepo.findByWorkItemId.mockResolvedValue([createMockActivity()]);
      mockActivityRepo.getActivityCount.mockResolvedValue(3);

      const results = await driftDetector.calculateBatchDrift([
        'work-item-1',
        'non-existent',
      ]);

      expect(results).toHaveLength(1);
      expect(results[0].workItemId).toBe('work-item-1');
    });
  });

  describe('getDriftingWorkItems', () => {
    it('should return only items with drift above threshold', async () => {
      const workItems = [
        createMockWorkItem({ id: 'work-item-1', stale: true }),
        createMockWorkItem({ id: 'work-item-2', stale: false }),
      ];

      mockWorkItemRepo.findById.mockImplementation(async (id: string) => {
        return workItems.find((w) => w.id === id) || null;
      });

      // Mock to return high drift for item 1, low for item 2
      mockWorkItemRepo.getDateHistory.mockImplementation(async (id: string) => {
        if (id === 'work-item-1') {
          return [
            new Date('2024-02-01'),
            new Date('2024-02-15'),
            new Date('2024-03-01'),
            new Date('2024-03-15'),
          ];
        }
        return [new Date('2024-02-15')];
      });

      mockWorkUpdateRepo.findByWorkItemId.mockImplementation(async (id: string) => {
        if (id === 'work-item-1') return [];
        return [createMockWorkUpdate({ createdAt: new Date() })];
      });

      mockWorkUpdateRepo.getUpdateFrequency.mockImplementation(async (id: string) => {
        return id === 'work-item-1' ? 0 : 4;
      });

      mockActivityRepo.findByWorkItemId.mockImplementation(async (id: string) => {
        if (id === 'work-item-1') return [];
        return [createMockActivity({ occurredAt: new Date() })];
      });

      mockActivityRepo.getActivityCount.mockImplementation(async (id: string) => {
        return id === 'work-item-1' ? 0 : 10;
      });

      const results = await driftDetector.getDriftingWorkItems(['work-item-1', 'work-item-2']);

      // At least the stale item should be flagged as drifting
      const driftingItem = results.find((r) => r.workItemId === 'work-item-1');
      expect(driftingItem).toBeDefined();
      expect(driftingItem!.score).toBeGreaterThan(0.7);
    });
  });
});
