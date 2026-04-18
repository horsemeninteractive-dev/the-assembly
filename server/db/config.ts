import { adminDb, isConfigured } from './core';
import { SystemConfig } from '../../shared/types';

const DEFAULT_CONFIG: SystemConfig = {
  maintenanceMode: false,
  xpMultiplier: 1.0,
  ipMultiplier: 1.0,
  minVersion: '0.9.0',
  currentSeasonNumber: 0,
  currentSeasonPeriod: 'Season 0',
  currentSeasonEndsAt: '2026-05-02T00:00:00.000Z',
};

export async function getSystemConfig(): Promise<SystemConfig> {
  if (!isConfigured) return { ...DEFAULT_CONFIG };

  try {
    const { data, error } = await adminDb
      .from('system_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) return { ...DEFAULT_CONFIG };

    return {
      maintenanceMode: !!data.maintenance_mode,
      xpMultiplier: Number(data.xp_multiplier) || 1.0,
      ipMultiplier: Number(data.ip_multiplier) || 1.0,
      minVersion: data.min_version || '0.9.0',
      currentSeasonNumber: Number(data.current_season_number) ?? 0,
      currentSeasonPeriod: data.current_season_period ?? 'Season 0',
      currentSeasonEndsAt: data.current_season_ends_at ?? '2026-05-02T00:00:00.000Z',
    };
  } catch (err) {
    return { ...DEFAULT_CONFIG };
  }
}

export async function updateSystemConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
  // Always get current first to ensure we merge correctly
  const current = await getSystemConfig();
  const updated = { ...current, ...config };

  if (isConfigured) {
    const payload: Record<string, unknown> = {
      id: 1, // Enforce single row
      maintenance_mode: updated.maintenanceMode,
      xp_multiplier: updated.xpMultiplier,
      ip_multiplier: updated.ipMultiplier,
      min_version: updated.minVersion,
      current_season_number: updated.currentSeasonNumber,
      current_season_period: updated.currentSeasonPeriod,
      current_season_ends_at: updated.currentSeasonEndsAt,
    };

    const { error } = await adminDb.from('system_config').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Failed to persist system config:', error);
    }
  }
  return updated;
}
