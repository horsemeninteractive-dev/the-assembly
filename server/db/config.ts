import { adminDb, db, isConfigured } from './core';
import { SystemConfig } from '../../shared/types';

export async function getSystemConfig(): Promise<SystemConfig> {
  const defaultConfig: SystemConfig = {
    maintenanceMode: false,
    xpMultiplier: 1.0,
    ipMultiplier: 1.0,
    minVersion: '0.9.0',
  };

  if (isConfigured) {
    const { data, error } = await db.from('system_config').select('*').eq('id', 1).single();
    if (error || !data) return defaultConfig;
    return {
      maintenanceMode: data.maintenance_mode,
      xpMultiplier: Number(data.xp_multiplier),
      ipMultiplier: Number(data.ip_multiplier),
      minVersion: data.min_version,
    };
  }
  return defaultConfig;
}

export async function updateSystemConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
  const current = await getSystemConfig();
  const updated = { ...current, ...config };

  if (isConfigured) {
    await adminDb
      .from('system_config')
      .update({
        maintenance_mode: updated.maintenanceMode,
        xp_multiplier: updated.xpMultiplier,
        ip_multiplier: updated.ipMultiplier,
        min_version: updated.minVersion,
      })
      .eq('id', 1);
  }
  return updated;
}

