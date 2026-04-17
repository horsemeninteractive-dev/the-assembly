import { adminDb, db, isConfigured } from './core';
import { SystemConfig } from '../../shared/types';

export async function getSystemConfig(): Promise<SystemConfig> {
  const defaultConfig: SystemConfig = {
    maintenanceMode: false,
    xpMultiplier: 1.0,
    ipMultiplier: 1.0,
    minVersion: '0.9.0',
  };

  if (!isConfigured) return defaultConfig;

  try {
    const { data, error } = await adminDb
      .from('system_config')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) return defaultConfig;

    return {
      maintenanceMode: !!data.maintenance_mode,
      xpMultiplier: Number(data.xp_multiplier) || 1.0,
      ipMultiplier: Number(data.ip_multiplier) || 1.0,
      minVersion: data.min_version || '0.9.0',
    };
  } catch (err) {
    return defaultConfig;
  }
}

export async function updateSystemConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
  // Always get current first to ensure we merge correctly
  const current = await getSystemConfig();
  const updated = { ...current, ...config };

  if (isConfigured) {
    const payload = {
      id: 1, // Enforce single row
      maintenance_mode: updated.maintenanceMode,
      xp_multiplier: updated.xpMultiplier,
      ip_multiplier: updated.ipMultiplier,
      min_version: updated.minVersion,
    };

    const { error } = await adminDb.from('system_config').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Failed to persist system config:', error);
    }
  }
  return updated;
}
