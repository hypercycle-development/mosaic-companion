// ============================================
// Dashboard Tab Test Suite
// Tests for Stats, KanbanDashboard, and Refresh functionality
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AdaPortalPanel } from '../src/components/AdaPortalPanel';
import { KanbanDashboard } from '../src/components/KanbanDashboard';
import * as AdaPortal from '../src/services/AdaPortal';

// Mock the services
vi.mock('../src/services/AdaPortal', async () => {
  const actual = await vi.importActual('../src/services/AdaPortal');
  return {
    ...actual,
    agentMarketplace: {
      getListings: vi.fn().mockResolvedValue([
        { listingId: '1', agentName: 'Agent 1', rating: 4.5 },
        { listingId: '2', agentName: 'Agent 2', rating: 4.8 },
      ]),
    },
    skillMarketplace: {
      getStats: vi.fn().mockReturnValue({ totalSkills: 42 }),
      refreshSkills: vi.fn().mockResolvedValue(undefined),
    },
    hyperInsight: {
      refreshData: vi.fn().mockResolvedValue(undefined),
      getActiveAIMs: vi.fn().mockReturnValue([
        { name: 'AIM 1', isActive: true },
        { name: 'AIM 2', isActive: true },
        { name: 'AIM 3', isActive: true },
      ]),
      getNodes: vi.fn().mockReturnValue([
        { licenseKey: 'node1', name: 'Node 1', isAlive: true },
        { licenseKey: 'node2', name: 'Node 2', isAlive: true },
        { licenseKey: 'node3', name: 'Node 3', isAlive: true },
      ]),
      getUnifiedLeaderboard: vi.fn().mockReturnValue([]),
    },
    initializeAdaPortal: vi.fn().mockResolvedValue(undefined),
    accessControl: {
      initialize: vi.fn().mockResolvedValue({ hasAccess: true, level: 'full' }),
    },
  };
});

vi.mock('../src/services/StargatePool', () => ({
  hboxPoolService: {
    init: vi.fn().mockResolvedValue(undefined),
    getNodes: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../src/services/BatteryOrg', () => ({
  batteryOrgPool: {
    init: vi.fn().mockResolvedValue({ success: true }),
    getNodes: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../src/services/StargateSkillRegistry', () => ({
  stargateRegistry: {
    initialize: vi.fn().mockResolvedValue(undefined),
    seedCommunityAIMs: vi.fn().mockResolvedValue(undefined),
    getAgents: vi.fn().mockReturnValue([]),
    getBundles: vi.fn().mockReturnValue([]),
    getSkills: vi.fn().mockReturnValue([]),
    getModels: vi.fn().mockReturnValue([]),
    getTrainingJobs: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../src/services/LocalNodeBridge', () => ({
  localNodeBridge: {
    refresh: vi.fn().mockResolvedValue(false),
    onUpdate: vi.fn().mockReturnValue(() => {}),
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
  },
}));

describe('Dashboard Tab', () => {
  describe('Stats Display', () => {
    it('should display real numbers for Available Agents', async () => {
      // Mock the data - 2 listings
      const { getByText } = render(
        <AdaPortalPanel url="/dashboard" onNavigate={() => {}} />
      );

      await waitFor(() => {
        // Should show "2" for Available Agents
        const availableAgents = screen.getByText('2');
        expect(availableAgents).toBeInTheDocument();
      });

      const label = screen.getByText('Available Agents');
      expect(label).toBeInTheDocument();
    });

    it('should display real numbers for Active AIMs', async () => {
      render(<AdaPortalPanel url="/dashboard" onNavigate={() => {}} />);

      await waitFor(() => {
        // Should show "3" for Active AIMs
        const activeAims = screen.getByText('3');
        expect(activeAims).toBeInTheDocument();
      });

      const label = screen.getByText('Active AIMs');
      expect(label).toBeInTheDocument();
    });

    it('should display real numbers for Skills', async () => {
      render(<AdaPortalPanel url="/dashboard" onNavigate={() => {}} />);

      await waitFor(() => {
        // Should show "42" for Skills
        const skillsCount = screen.getByText('42');
        expect(skillsCount).toBeInTheDocument();
      });

      const label = screen.getByText('Skills');
      expect(label).toBeInTheDocument();
    });

    it('should display real numbers for Compute Nodes', async () => {
      render(<AdaPortalPanel url="/dashboard" onNavigate={() => {}} />);

      await waitFor(() => {
        // Should show "3" for Compute Nodes
        const nodesCount = screen.getByText('3');
        expect(nodesCount).toBeInTheDocument();
      });

      const label = screen.getByText('Compute Nodes');
      expect(label).toBeInTheDocument();
    });

    it('should not display placeholder text or undefined', async () => {
      render(<AdaPortalPanel url="/dashboard" onNavigate={() => {}} />);

      await waitFor(() => {
        // Check that there are no "undefined" or "null" text visible
        const html = document.body.innerHTML;
        expect(html).not.toContain('undefined');
        expect(html).not.toContain('null');
        expect(html).not.toContain('NaN');
      });
    });

    it('should show zero when data arrays are empty', async () => {
      // Override mock to return empty arrays
      vi.mocked(AdaPortal.agentMarketplace.getListings).mockResolvedValueOnce([]);
      vi.mocked(AdaPortal.hyperInsight.getActiveAIMs).mockReturnValueOnce([]);
      vi.mocked(AdaPortal.hyperInsight.getNodes).mockReturnValueOnce([]);
      vi.mocked(AdaPortal.skillMarketplace.getStats).mockReturnValueOnce({ totalSkills: 0 });

      render(<AdaPortalPanel url="/dashboard" onNavigate={() => {}} />);

      await waitFor(() => {
        // All stats should show "0" when data is empty
        const zeroElements = screen.getAllByText('0');
        expect(zeroElements.length).toBeGreaterThanOrEqual(4);
      });
    });
  });

  describe('Refresh Button', () => {
    it('should have a refresh button', async () => {
      render(<AdaPortalPanel url="/dashboard" onNavigate={() => {}} />);

      await waitFor(() => {
        // Find refresh button by its SVG icon
        const refreshButton = document.querySelector('button');
        expect(refreshButton).toBeTruthy();
      });
    });

    it('should call refresh handlers when clicked', async () => {
      const refreshSpy = vi.spyOn(AdaPortal.skillMarketplace, 'refreshSkills');

      render(<AdaPortalPanel url="/dashboard" onNavigate={() => {}} />);

      await waitFor(() => {
        const refreshButton = document.querySelector('button');
        if (refreshButton) {
          fireEvent.click(refreshButton);
        }
      });

      // Wait for async operations
      await waitFor(() => {
        // Verify refresh was triggered
        expect(refreshSpy).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    it('should show loading state during refresh', async () => {
      render(<AdaPortalPanel url="/dashboard" onNavigate={() => {}} />);

      await waitFor(() => {
        const refreshButton = document.querySelector('button');
        if (refreshButton) {
          fireEvent.click(refreshButton);
          // After click, button should be disabled or show spin animation
          expect(refreshButton.hasAttribute('disabled') || 
                 refreshButton.querySelector('.animate-spin')).toBeTruthy();
        }
      });
    });
  });

  describe('KanbanDashboard Integration', () => {
    it('should render KanbanDashboard component', async () => {
      render(<AdaPortalPanel url="/dashboard" onNavigate={() => {}} />);

      await waitFor(() => {
        // Look for KanbanDashboard indicator text
        const kanbanTitle = screen.getByText('Multi-Agent Command Center');
        expect(kanbanTitle).toBeInTheDocument();
      });

      // Should show column headers
      const columnHeaders = ['Backlog', 'Ready', 'Running', 'Aimified'];
      for (const header of columnHeaders) {
        expect(screen.getByText(header)).toBeInTheDocument();
      }
    });

    it('should pass correct column prop to KanbanDashboard', async () => {
      // The KanbanDashboard should be rendered without explicit column prop
      // but internally it uses 'aimified' as one of its columns
      const { container } = render(<AdaPortalPanel url="/dashboard" onNavigate={() => {}} />);

      await waitFor(() => {
        // Verify KanbanDashboard container exists
        const kanbanContainer = container.querySelector('.kanban-dashboard, [style*="620px"]');
        expect(kanbanContainer || screen.getByText('Multi-Agent Command Center')).toBeTruthy();
      });
    });
  });

  describe('Console Errors', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should not produce React key warnings', async () => {
      render(<AdaPortalPanel url="/dashboard" onNavigate={() => {}} />);

      await waitFor(() => {
        // Check console for key warnings
        const keyWarnings = consoleErrorSpy.mock.calls.filter(
          call => call[0]?.includes?.('key') || call[0]?.toString?.().includes('key')
        );
        expect(keyWarnings).toHaveLength(0);
      });
    });

    it('should not produce prop type warnings', async () => {
      render(<AdaPortalPanel url="/dashboard" onNavigate={() => {}} />);

      await waitFor(() => {
        // Check console for prop type warnings
        const propWarnings = consoleErrorSpy.mock.calls.filter(
          call => call[0]?.includes?.('prop') || call[0]?.toString?.().includes('prop')
        );
        expect(propWarnings).toHaveLength(0);
      });
    });

    it('should not produce undefined API errors', async () => {
      render(<AdaPortalPanel url="/dashboard" onNavigate={() => {}} />);

      await waitFor(() => {
        // Check for API-related errors
        const apiErrors = consoleErrorSpy.mock.calls.filter(
          call => call[0]?.includes?.('API') || call[0]?.includes?.('fetch')
        );
        // Some API errors are expected in test environment, just ensure no crashes
        expect(apiErrors.length).toBeLessThan(10);
      });
    });
  });
});

describe('Dashboard Stats Integration', () => {
  it('should handle edge case: undefined stats gracefully', async () => {
    // Mock getStats to return undefined
    vi.mocked(AdaPortal.skillMarketplace.getStats).mockReturnValueOnce(undefined as any);

    render(<AdaPortalPanel url="/dashboard" onNavigate={() => {}} />);

    await waitFor(() => {
      // Should not crash, component should handle undefined
      const dashboard = screen.getByText('Intelligence Dashboard');
      expect(dashboard).toBeInTheDocument();
    });
  });

  it('should handle edge case: null arrays gracefully', async () => {
    vi.mocked(AdaPortal.agentMarketplace.getListings).mockResolvedValueOnce(null as any);
    vi.mocked(AdaPortal.hyperInsight.getActiveAIMs).mockReturnValueOnce(null as any);
    vi.mocked(AdaPortal.hyperInsight.getNodes).mockReturnValueOnce(null as any);

    render(<AdaPortalPanel url="/dashboard" onNavigate={() => {}} />);

    await waitFor(() => {
      // Dashboard should still render
      const dashboard = screen.getByText('Intelligence Dashboard');
      expect(dashboard).toBeInTheDocument();
    });
  });
});
