import { useState, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '../../store';
import { hanaFetch } from '../../api';
import { t } from '../../helpers';
import { loadSettingsConfig, loadAgents } from '../../actions';
import { SettingsSection } from '../../components/SettingsSection';
import { SettingsRow } from '../../components/SettingsRow';
import { Toggle } from '../../widgets/Toggle';
import styles from '../../Settings.module.css';

const MODULE_KEYS = ['platform', 'environment', 'sections', 'skills', 'background_tasks', 'workspace'] as const;
type ModuleKey = (typeof MODULE_KEYS)[number];

export function SystemPromptModules() {
  const { settingsAgentId, currentAgentId } = useSettingsStore(
    useShallow(s => ({
      settingsAgentId: s.settingsAgentId,
      currentAgentId: s.currentAgentId,
    }))
  );
  const settingsConfig = useSettingsStore(s => s.settingsConfig);

  const [modules, setModules] = useState<Record<ModuleKey, boolean>>({
    platform: true,
    environment: true,
    sections: true,
    skills: true,
    background_tasks: true,
    workspace: true,
  });

  useEffect(() => {
    const spm = (settingsConfig as any)?.system_prompt_modules || {};
    const next = { ...modules };
    for (const key of MODULE_KEYS) {
      next[key] = spm[key] !== false;
    }
    setModules(next);
  }, [settingsConfig]);

  const agentId = settingsAgentId || currentAgentId;
  if (!agentId) return null;

  const toggleModule = async (key: ModuleKey, on: boolean) => {
    setModules(prev => ({ ...prev, [key]: on }));
    try {
      await hanaFetch(`/api/agents/${agentId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_prompt_modules: { [key]: on } }),
      });
      await loadSettingsConfig();
      await loadAgents();
    } catch (err) {
      console.error('[system-prompt-modules] toggle failed:', err);
    }
  };

  return (
    <SettingsSection title={t('settings.agent.systemPromptModules.title')}>
      <div style={{ padding: '0 var(--space-md) var(--space-sm)' }}>
        <span className={styles['settings-form-hint']}>
          {t('settings.agent.systemPromptModules.hint')}
        </span>
      </div>
      {MODULE_KEYS.map(key => (
        <SettingsRow
          key={key}
          label={t(`settings.agent.systemPromptModules.${key}`)}
          hint={t(`settings.agent.systemPromptModules.${key}Hint`)}
          control={
            <Toggle
              on={modules[key]}
              onChange={(on: boolean) => toggleModule(key, on)}
            />
          }
        />
      ))}
    </SettingsSection>
  );
}
