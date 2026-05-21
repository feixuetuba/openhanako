import { useState, useEffect, useRef } from 'react';
import { useSettingsStore } from '../../store';
import { hanaFetch } from '../../api';
import { t, autoSaveConfig, savePins } from '../../helpers';
import { PinItem } from './AgentPins';
import { SettingsSection } from '../../components/SettingsSection';
import styles from '../../Settings.module.css';

export function MemorySection({ hasUtilityModel, memoryEnabled, isViewingOther, currentPins }: {
  hasUtilityModel: boolean;
  memoryEnabled: boolean;
  isViewingOther: boolean;
  currentPins: string[];
}) {
  const [pinInput, setPinInput] = useState('');

  const addPin = () => {
    const val = pinInput.trim();
    if (!val) return;
    const newPins = [...currentPins, val];
    useSettingsStore.setState({ currentPins: newPins });
    setPinInput('');
    savePins();
  };

  const deletePin = (index: number) => {
    const newPins = [...currentPins];
    newPins.splice(index, 1);
    useSettingsStore.setState({ currentPins: newPins });
    savePins();
  };

  /* 记忆开关作为 section title 右侧 context（和 WorkTab 的 AgentSelect 作 context 同构）
   * hasUtilityModel=false 时 toggle 禁用，below 显示提示 */
  const memoryToggle = (
    <button
      className={`hana-toggle${hasUtilityModel && memoryEnabled ? ' on' : ''}${!hasUtilityModel ? ' disabled' : ''}`}
      onClick={() => hasUtilityModel && autoSaveConfig({ memory: { enabled: !memoryEnabled } })}
      disabled={!hasUtilityModel}
      title={!hasUtilityModel ? t('settings.memory.needsUtilityModel') : undefined}
    />
  );

  return (
    <SettingsSection title={t('settings.memory.sectionTitle')} context={memoryToggle}>
      <div style={{ padding: 'var(--space-sm) var(--space-md)' }}>
        {!hasUtilityModel && (
          <p className={styles['settings-inline-note']} style={{ opacity: 0.6, marginTop: 0, marginBottom: 'var(--space-md)' }}>{t('settings.memory.needsUtilityModel')}</p>
        )}

        <div className={!hasUtilityModel || !memoryEnabled ? 'settings-disabled' : ''}>
          <div className={styles['settings-subsection']}>
            <div className={styles['settings-subsection-header']}>
              <h3 className={styles['settings-subsection-title']}>{t('settings.pins.title')}</h3>
              <span className={styles['settings-subsection-hint']}>{t('settings.pins.hint')}</span>
            </div>
            <div className={styles['pin-list']}>
              {currentPins.length === 0 ? (
                <div className={styles['pin-empty']}>{t('settings.pins.empty')}</div>
              ) : (
                currentPins.map((pin, i) => (
                  <PinItem key={pin} text={pin} index={i} onDelete={deletePin} />
                ))
              )}
            </div>
            <div className={styles['pin-add-row']}>
              <input
                className={`${styles['settings-input']} ${styles['pin-add-input']}`}
                type="text"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPin(); } }}
                placeholder={t('settings.pins.addPlaceholder')}
              />
              <button className={styles['pin-add-btn']} onClick={addPin}>+</button>
            </div>
          </div>

          <div className={styles['settings-subsection']}>
            <div className={styles['settings-subsection-header']}>
              <h3 className={styles['settings-subsection-title']}>{t('settings.memory.compiled')}</h3>
              <span className={styles['settings-subsection-hint']}>{t('settings.memory.compiledHint')}</span>
            </div>
            <button
              className={`${styles['memory-action-btn']} ${styles['compiled-view-btn']}`}
              onClick={() => window.dispatchEvent(new Event('hana-view-compiled-memory'))}
            >
              {t('settings.memory.compiledView')}
            </button>
          </div>

          <div className={styles['settings-subsection']}>
            <h3 className={styles['settings-subsection-title']}>{t('settings.memory.allMemories')}</h3>
            <div className={`${styles['memory-actions-row']} ${styles['memory-actions-spaced']}`}>
              <button
                className={styles['memory-action-btn']}
                onClick={() => window.dispatchEvent(new Event('hana-view-memories'))}
              >
                {t('settings.memory.actions.view')}
              </button>
              <button
                className={`${styles['memory-action-btn']} ${styles['danger']}`}
                onClick={() => window.dispatchEvent(new Event('hana-show-clear-confirm'))}
              >
                {t('settings.memory.actions.clear')}
              </button>
              <MemoryMoreDropdown isViewingOther={isViewingOther} />
            </div>
          </div>
        </div>{/* settings-disabled wrapper */}
      </div>
    </SettingsSection>
  );
}

function MemoryMoreDropdown({ isViewingOther }: { isViewingOther: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Only actions needed — use getState() to avoid subscribing to the full store
  const getStore = () => useSettingsStore.getState();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const exportMemories = async () => {
    setOpen(false);
    try {
      const aid = getStore().getSettingsAgentId();
      const res = await hanaFetch(`/api/memories/export?agentId=${aid}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      // eslint-disable-next-line no-restricted-syntax -- ephemeral download link for memory export
      const a = document.createElement('a');
      a.href = url;
      a.download = `hana-memories-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      getStore().showToast(t('settings.memory.actions.exportSuccess'), 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      getStore().showToast(t('settings.saveFailed') + ': ' + msg, 'error');
    }
  };

  const importMemories = async () => {
    setOpen(false);
    // eslint-disable-next-line no-restricted-syntax -- ephemeral file picker for memory import
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const entries = json.facts || json.memories;
        if (!Array.isArray(entries) || entries.length === 0) {
          getStore().showToast(t('settings.memory.actions.invalidFile'), 'error');
          return;
        }
        getStore().showToast(t('settings.memory.actions.importing'), 'success');
        const aid = getStore().getSettingsAgentId();
        const res = await hanaFetch(`/api/memories/import?agentId=${aid}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ facts: entries }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const importMsg = t('settings.memory.actions.importSuccess').replace('{count}', data.imported);
        getStore().showToast(importMsg, 'success');
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        getStore().showToast(t('settings.saveFailed') + ': ' + errMsg, 'error');
      }
    });
    input.click();
  };

  return (
    <div className={`${styles['memory-action-dropdown']}${open  ? ' ' + styles['open'] : ''}`} ref={ref}>
      <button className={`${styles['memory-action-btn']} ${styles['secondary']}`} onClick={() => setOpen(!open)}>
        <span>{t('settings.memory.actions.more')}</span>
        <svg className={styles['memory-more-arrow']} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div className={styles['memory-more-popup']}>
        <button className={styles['memory-more-option']} onClick={exportMemories}>
          {t('settings.memory.actions.export')}
        </button>
        <button
          className={styles['memory-more-option']}
          onClick={importMemories}
          disabled={isViewingOther}
          title={isViewingOther ? t('settings.memory.activeOnly') : ''}
        >
          {t('settings.memory.actions.import')}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════
//  平台提示编辑器（platform-prompt.md）
// ════════════════════════════

export function PlatformPromptSection() {
  const [content, setContent] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const showToast = useSettingsStore(s => s.showToast);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const aid = useSettingsStore.getState().getSettingsAgentId();
      const res = await hanaFetch(`/api/agents/${aid}/platform-prompt`);
      const data = await res.json();
      setContent(data.content || '');
      setIsDefault(data.isDefault !== false);
    } catch { /* ignore */ }
  };

  const save = async () => {
    try {
      const aid = useSettingsStore.getState().getSettingsAgentId();
      const res = await hanaFetch(`/api/agents/${aid}/platform-prompt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setIsDefault(data.isEmpty);
      showToast(data.isEmpty ? t('settings.platformPrompt.resetToDefault') : t('settings.saved'), 'success');
    } catch (err: any) {
      showToast(t('settings.saveFailed') + ': ' + err.message, 'error');
    }
  };

  const resetToDefault = async () => {
    try {
      const aid = useSettingsStore.getState().getSettingsAgentId();
      await hanaFetch(`/api/agents/${aid}/platform-prompt`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      });
      await load();
      showToast(t('settings.platformPrompt.resetToDefault'), 'success');
    } catch (err: any) {
      showToast(t('settings.saveFailed') + ': ' + err.message, 'error');
    }
  };

  return (
    <SettingsSection title={t('settings.platformPrompt.title')}>
      <div style={{ padding: 'var(--space-sm) var(--space-md)' }}>
        <p className={styles['settings-inline-note']} style={{ marginTop: 0, marginBottom: 'var(--space-md)' }}>
          {isDefault ? t('settings.platformPrompt.defaultHint') : t('settings.platformPrompt.customHint')}
        </p>
        <textarea
          className={styles['settings-textarea']}
          rows={4}
          spellCheck={false}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div style={{ marginTop: 'var(--space-sm)', display: 'flex', gap: 'var(--space-sm)' }}>
          <button className={styles['settings-save-btn-sm']} onClick={save}>
            {t('settings.save')}
          </button>
          {!isDefault && (
            <button
              className={`${styles['memory-action-btn']} ${styles['secondary']}`}
              onClick={resetToDefault}
            >
              {t('settings.platformPrompt.resetToDefault')}
            </button>
          )}
        </div>
      </div>
    </SettingsSection>
  );
}

// ════════════════════════════
//  系统提示词段落编辑器（system-prompt-sections.md）
// ════════════════════════════

interface SectionDef {
  key: string;
  titleZh: string;
  titleEn: string;
}

const SECTION_META: SectionDef[] = [
  { key: 'identity', titleZh: '平台身份', titleEn: 'Identity' },
  { key: 'task-management', titleZh: '任务管理', titleEn: 'Task Management' },
  { key: 'experience-library', titleZh: '经验库', titleEn: 'Experience Library' },
  { key: 'tool-discipline', titleZh: '工具使用纪律', titleEn: 'Tool Discipline' },
  { key: 'current-view', titleZh: '当前视野', titleEn: 'Current View' },
  { key: 'session-files', titleZh: 'Session 文件与交付', titleEn: 'Session Files' },
  { key: 'computer-use', titleZh: '本机应用控制', titleEn: 'Computer Use' },
  { key: 'failure-handling', titleZh: '失败处理', titleEn: 'Failure Handling' },
  { key: 'action-safety', titleZh: '操作安全', titleEn: 'Action Safety' },
  { key: 'web-tools', titleZh: '网页工具优先级', titleEn: 'Web Tools' },
  { key: 'settings-changes', titleZh: '设置修改', titleEn: 'Settings Changes' },
  { key: 'skill-acquisition', titleZh: '主动技能获取', titleEn: 'Skill Acquisition' },
  { key: 'team', titleZh: '团队', titleEn: 'Team' },
  { key: 'workspace', titleZh: '工作空间', titleEn: 'Workspace' },
  { key: 'skill-file-identity', titleZh: '技能文件身份', titleEn: 'Skill File Identity' },
];

export function SystemPromptSections() {
  const [rawContent, setRawContent] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const showToast = useSettingsStore(s => s.showToast);
  const isZh = (window as any).i18n?.locale?.startsWith('zh') ?? true;

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const aid = useSettingsStore.getState().getSettingsAgentId();
      const res = await hanaFetch(`/api/agents/${aid}/system-prompt-sections`);
      const data = await res.json();
      setRawContent(data.content || '');
      setIsDefault(data.isDefault !== false);
    } catch { /* ignore */ }
  };

  const save = async () => {
    try {
      const aid = useSettingsStore.getState().getSettingsAgentId();
      const res = await hanaFetch(`/api/agents/${aid}/system-prompt-sections`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: rawContent }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setIsDefault(data.isEmpty);
      showToast(data.isEmpty ? t('settings.systemPrompt.resetToDefault') : t('settings.saved'), 'success');
    } catch (err: any) {
      showToast(t('settings.saveFailed') + ': ' + err.message, 'error');
    }
  };

  const resetToDefault = async () => {
    try {
      const aid = useSettingsStore.getState().getSettingsAgentId();
      await hanaFetch(`/api/agents/${aid}/system-prompt-sections`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      });
      await load();
      showToast(t('settings.systemPrompt.resetToDefault'), 'success');
    } catch (err: any) {
      showToast(t('settings.saveFailed') + ': ' + err.message, 'error');
    }
  };

  const startEdit = (key: string) => {
    // 从 rawContent 中提取该段落的内容
    const match = rawContent.match(new RegExp(`^##\\s+!?${key}\\s*\n([\\s\\S]*?)(?=^##\\s+|$)`, 'm'));
    setEditingKey(key);
    setEditContent(match ? match[1].trim() : '');
  };

  const saveEdit = () => {
    if (!editingKey) return;
    const lines = rawContent.split('\n');
    const headerRegex = new RegExp(`^##\\s+!?${editingKey}\\s*$`);
    let startIdx = -1;
    let endIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (headerRegex.test(lines[i])) {
        startIdx = i;
      } else if (startIdx !== -1 && /^##\s+/.test(lines[i])) {
        endIdx = i;
        break;
      }
    }

    if (startIdx === -1) {
      // 段落不存在，追加
      const newSection = `## ${editingKey}\n${editContent}\n`;
      setRawContent(prev => prev + (prev.endsWith('\n') ? '' : '\n') + newSection);
    } else {
      const newLines = [...lines];
      if (endIdx === -1) endIdx = lines.length;
      newLines.splice(startIdx + 1, endIdx - startIdx - 1, editContent);
      setRawContent(newLines.join('\n'));
    }
    setEditingKey(null);
  };

  const toggleSection = (key: string, enabled: boolean) => {
    setRawContent(prev => {
      const lines = prev.split('\n');
      const headerRegex = new RegExp(`^##\\s+!?${key}\\s*$`);
      for (let i = 0; i < lines.length; i++) {
        if (headerRegex.test(lines[i])) {
          lines[i] = enabled ? `## ${key}` : `## !${key}`;
          break;
        }
      }
      return lines.join('\n');
    });
  };

  const hasSection = (key: string) => {
    return new RegExp(`^##\\s+!?${key}\\s*$`, 'm').test(rawContent);
  };

  const isSectionEnabled = (key: string) => {
    const match = rawContent.match(new RegExp(`^##\\s+(!?)${key}\\s*$`, 'm'));
    return match ? !match[1] : true; // 不在文件中 = 默认启用
  };

  return (
    <SettingsSection title={t('settings.systemPrompt.title')}>
      <div style={{ padding: 'var(--space-sm) var(--space-md)' }}>
        <p className={styles['settings-inline-note']} style={{ marginTop: 0, marginBottom: 'var(--space-md)' }}>
          {isDefault ? t('settings.systemPrompt.defaultHint') : t('settings.systemPrompt.customHint')}
        </p>

        {/* 段落卡片列表 */}
        <div className={styles['sections-list']}>
          {SECTION_META.map(meta => {
            const exists = hasSection(meta.key);
            const enabled = isSectionEnabled(meta.key);
            const title = isZh ? meta.titleZh : meta.titleEn;

            return (
              <div key={meta.key} className={styles['section-card']}>
                <div className={styles['section-card-header']}>
                  <label className={styles['section-toggle-label']}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => {
                        const nextEnabled = e.target.checked;
                        if (!exists) {
                          // 首次启用：添加段落
                          setRawContent(prev => prev + (prev.endsWith('\n') ? '' : '\n') + `## ${meta.key}\n`);
                        } else {
                          toggleSection(meta.key, nextEnabled);
                        }
                      }}
                    />
                    <span className={styles['section-card-title']}>{title}</span>
                  </label>
                  <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                    <button
                      className={`${styles['memory-action-btn']} ${styles['secondary']}`}
                      onClick={() => startEdit(meta.key)}
                      disabled={!enabled}
                    >
                      {t('common.edit')}
                    </button>
                  </div>
                </div>
                {!enabled && exists && (
                  <span className={styles['section-disabled-note']}>
                    {t('settings.systemPrompt.disabled')}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* 编辑弹窗 */}
        {editingKey && (
          <div className={styles['section-edit-overlay']}>
            <div className={styles['section-edit-modal']}>
              <h4>{SECTION_META.find(s => s.key === editingKey)?.[isZh ? 'titleZh' : 'titleEn'] || editingKey}</h4>
              <textarea
                className={styles['settings-textarea']}
                rows={10}
                spellCheck={false}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
              <div style={{ marginTop: 'var(--space-sm)', display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
                <button
                  className={`${styles['memory-action-btn']} ${styles['secondary']}`}
                  onClick={() => setEditingKey(null)}
                >
                  {t('common.cancel')}
                </button>
                <button className={styles['settings-save-btn-sm']} onClick={saveEdit}>
                  {t('settings.save')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-sm)' }}>
          <button className={styles['settings-save-btn-sm']} onClick={save}>
            {t('settings.save')}
          </button>
          {!isDefault && (
            <button
              className={`${styles['memory-action-btn']} ${styles['secondary']}`}
              onClick={resetToDefault}
            >
              {t('settings.systemPrompt.resetToDefault')}
            </button>
          )}
        </div>
      </div>
    </SettingsSection>
  );
}
