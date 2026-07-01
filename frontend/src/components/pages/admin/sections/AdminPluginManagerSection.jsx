import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader } from '../../../atoms/Card.jsx';
import Button from '../../../atoms/Button.jsx';
import TextInput from '../../../atoms/TextInput.jsx';

function AdminPluginManagerSection({
  sortPluginsMutation,
  pluginsQuery,
  managedPlugins,
  pluginDraft,
  setPluginDraft,
  editingPluginId,
  createPluginPending,
  updatePluginPending,
  onPluginSave,
  onPluginReset,
  pluginValidationError,
  pluginSaveError,
  onOpenCreateModal,
  showCreateModal,
  onCloseCreateModal,
  startEditing,
  deletePluginMutation,
  pluginSuggestions,
  onCreatePluginFromSuggestion
}) {
  const isSaving = createPluginPending || updatePluginPending;

  return (
    <section className="section">
      <Card>
        <CardHeader>
          <div>
            <h2 id="admin-plugin-manager-main">Plugin manager</h2>
            <p className="card__meta">
              Add, edit, or remove plugins in the Turso-backed plugin registry.
            </p>
          </div>
          <div className="card__actions">
            <Button type="button" size="sm" onClick={onOpenCreateModal}>
              Add plugin
            </Button>
            <span className="tooltip">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => sortPluginsMutation.mutate()}
                disabled={sortPluginsMutation.isPending || pluginsQuery.isLoading}
              >
                {sortPluginsMutation.isPending ? 'Sorting…' : 'Sort plugins'}
              </Button>
              <span className="tooltip__content">
                Alphabetize plugin entries by label.
              </span>
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {pluginsQuery.isLoading ? (
            <p className="card__meta">Loading plugins…</p>
          ) : pluginsQuery.isError ? (
            <div className="card card--error">
              <div className="card__content">
                <p>{pluginsQuery.error?.message ?? 'Failed to load plugins.'}</p>
              </div>
            </div>
          ) : (
            <div className="admin-table admin-table--plugins">
              <div className="admin-table__header">
                <span>Plugin</span>
                <span>Namespaces</span>
                <span>Asset hints</span>
                <span>Actions</span>
              </div>
              {managedPlugins.map((plugin) => {
                const isEditing = editingPluginId === plugin.id;
                return (
                  <div key={plugin.id} className="admin-table__row admin-table__row--expandable">
                    <span className="admin-table__cell admin-table__cell--expand">
                      <strong>{plugin.label}</strong>
                      <div className="muted">{plugin.id}</div>
                      {plugin.pluginUrl ? (
                        <div>
                          <a href={plugin.pluginUrl} target="_blank" rel="noreferrer">
                            Docs
                          </a>
                        </div>
                      ) : null}
                      <div className="muted">{plugin.description || 'No description'}</div>
                    </span>
                    <span>{plugin.namespaces?.length ?? 0}</span>
                    <span>{plugin.assetHints?.length ?? 0}</span>
                    <span>
                      <div className="button-group">
                        <Button
                          type="button"
                          size="sm"
                          variant={isEditing ? 'secondary' : 'ghost'}
                          onClick={() => {
                            if (isEditing) {
                              onPluginReset();
                            } else {
                              startEditing(plugin);
                            }
                          }}
                        >
                          {isEditing ? 'Cancel' : 'Edit'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (window.confirm(`Delete plugin "${plugin.label}"?`)) {
                              deletePluginMutation.mutate(plugin.id);
                            }
                          }}
                          disabled={deletePluginMutation.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </span>
                    {isEditing ? (
                      <div className="admin-table__details">
                        <p className="card__meta">Editing {plugin.id}</p>
                        <div className="registry-inline-editor">
                          <PluginFormFields
                            pluginDraft={pluginDraft}
                            setPluginDraft={setPluginDraft}
                            disableId
                          />
                          <div className="button-group registry-inline-editor__actions">
                            <Button type="button" size="sm" onClick={onPluginSave} disabled={isSaving}>
                              {updatePluginPending ? 'Saving…' : 'Save changes'}
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={onPluginReset}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                        {pluginSaveError ? <p className="card__meta">{pluginSaveError}</p> : null}
                        {pluginValidationError ? (
                          <p className="card__meta admin-validation-error">{pluginValidationError}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {showCreateModal ? (
        <RegistryModal
          title="Add plugin"
          onClose={onCloseCreateModal}
          onSubmit={onPluginSave}
          submitLabel={createPluginPending ? 'Adding…' : 'Add plugin'}
          isSubmitting={createPluginPending}
        >
          <PluginFormFields
            pluginDraft={pluginDraft}
            setPluginDraft={setPluginDraft}
            disableId={false}
            pluginSuggestions={pluginSuggestions}
            onCreatePluginFromSuggestion={onCreatePluginFromSuggestion}
          />
          {pluginSaveError ? <p className="card__meta">{pluginSaveError}</p> : null}
          {pluginValidationError ? (
            <p className="card__meta admin-validation-error">{pluginValidationError}</p>
          ) : null}
        </RegistryModal>
      ) : null}
    </section>
  );
}

function PluginFormFields({
  pluginDraft,
  setPluginDraft,
  disableId,
  pluginSuggestions = [],
  onCreatePluginFromSuggestion
}) {
  return (
    <div className="registry-form-grid">
      <label className="stacked-form__label">
        ID
        <TextInput
          type="text"
          value={pluginDraft.id}
          onChange={(event) => setPluginDraft((prev) => ({ ...prev, id: event.target.value }))}
          disabled={disableId}
          required
        />
        <SuggestionCloud
          query={pluginDraft.id}
          suggestions={pluginSuggestions}
          onPick={onCreatePluginFromSuggestion}
        />
      </label>
      <label className="stacked-form__label">
        Label
        <TextInput
          type="text"
          value={pluginDraft.label}
          onChange={(event) => setPluginDraft((prev) => ({ ...prev, label: event.target.value }))}
          required
        />
        <SuggestionCloud
          query={pluginDraft.label}
          suggestions={pluginSuggestions}
          onPick={onCreatePluginFromSuggestion}
        />
      </label>
      <label className="stacked-form__label registry-form-grid__full">
        Description
        <textarea
          value={pluginDraft.description}
          onChange={(event) => setPluginDraft((prev) => ({ ...prev, description: event.target.value }))}
        />
      </label>
      <label className="stacked-form__label registry-form-grid__full">
        Plugin URL
        <TextInput
          type="url"
          value={pluginDraft.pluginUrl}
          onChange={(event) => setPluginDraft((prev) => ({ ...prev, pluginUrl: event.target.value }))}
          placeholder="https://wordpress.org/plugins/..."
        />
        <SuggestionCloud
          query={pluginDraft.pluginUrl}
          suggestions={pluginSuggestions}
          onPick={onCreatePluginFromSuggestion}
        />
      </label>
      <label className="stacked-form__label">
        Namespaces (comma or newline separated)
        <textarea
          value={pluginDraft.namespaces}
          onChange={(event) => setPluginDraft((prev) => ({ ...prev, namespaces: event.target.value }))}
          placeholder="wc/v3\nwc/store/v1"
          aria-label="Namespaces (comma or newline separated)"
        />
        <span className="card__meta">Optional for asset-only detections.</span>
        <SuggestionCloud
          query={pluginDraft.namespaces}
          suggestions={pluginSuggestions}
          onPick={onCreatePluginFromSuggestion}
        />
      </label>
      <label className="stacked-form__label">
        Asset hints (comma or newline separated)
        <textarea
          value={pluginDraft.assetHints}
          onChange={(event) => setPluginDraft((prev) => ({ ...prev, assetHints: event.target.value }))}
          placeholder="woocommerce\nwc-analytics"
          aria-label="Asset hints (comma or newline separated)"
        />
        <SuggestionCloud
          query={pluginDraft.assetHints}
          suggestions={pluginSuggestions}
          onPick={onCreatePluginFromSuggestion}
        />
      </label>
    </div>
  );
}

function SuggestionCloud({ query = '', suggestions = [], onPick }) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return null;
  }

  const matches = suggestions
    .filter((suggestion) => suggestion.searchText.includes(normalizedQuery))
    .slice(0, 6);

  if (!matches.length) {
    return null;
  }

  return (
    <div className="tag-cloud tag-cloud--compact registry-suggestion-cloud" aria-label="Suggestion list">
      {matches.map((suggestion) => (
        <button
          key={suggestion.key}
          type="button"
          className="tag tag--button"
          title={suggestion.meta}
          onClick={() => onPick(suggestion)}
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}

function RegistryModal({ title, onClose, onSubmit, submitLabel, isSubmitting, children }) {
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement;

    const panel = panelRef.current;
    if (!panel) {
      return undefined;
    }

    const focusables = getFocusableElements(panel);
    const primaryField = panel.querySelector('input:not([disabled]), textarea:not([disabled]), select:not([disabled])');
    if (focusables.length > 0) {
      (primaryField ?? focusables[0]).focus();
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const nodes = getFocusableElements(panel);
      if (!nodes.length) {
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (restoreFocusRef.current instanceof HTMLElement) {
        restoreFocusRef.current.focus();
      }
    };
  }, []);

  return (
    <div className="registry-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="registry-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="registry-modal__panel" ref={panelRef}>
        <div className="registry-modal__header">
          <h3>{title}</h3>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="registry-modal__body">{children}</div>
        <div className="registry-modal__footer">
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={onSubmit} disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

AdminPluginManagerSection.propTypes = {
  sortPluginsMutation: PropTypes.shape({
    mutate: PropTypes.func.isRequired,
    isPending: PropTypes.bool
  }).isRequired,
  pluginsQuery: PropTypes.shape({
    isLoading: PropTypes.bool,
    isError: PropTypes.bool,
    error: PropTypes.object
  }).isRequired,
  managedPlugins: PropTypes.array,
  pluginDraft: PropTypes.shape({
    id: PropTypes.string,
    label: PropTypes.string,
    description: PropTypes.string,
    pluginUrl: PropTypes.string,
    namespaces: PropTypes.string,
    assetHints: PropTypes.string
  }).isRequired,
  setPluginDraft: PropTypes.func.isRequired,
  editingPluginId: PropTypes.string,
  createPluginPending: PropTypes.bool,
  updatePluginPending: PropTypes.bool,
  onPluginSave: PropTypes.func.isRequired,
  onPluginReset: PropTypes.func.isRequired,
  pluginValidationError: PropTypes.string,
  pluginSaveError: PropTypes.string,
  onOpenCreateModal: PropTypes.func.isRequired,
  showCreateModal: PropTypes.bool,
  onCloseCreateModal: PropTypes.func.isRequired,
  startEditing: PropTypes.func.isRequired,
  deletePluginMutation: PropTypes.shape({
    mutate: PropTypes.func.isRequired,
    isPending: PropTypes.bool
   }).isRequired,
  pluginSuggestions: PropTypes.array,
  onCreatePluginFromSuggestion: PropTypes.func.isRequired
};

PluginFormFields.propTypes = {
  pluginDraft: PropTypes.object.isRequired,
  setPluginDraft: PropTypes.func.isRequired,
  disableId: PropTypes.bool,
  pluginSuggestions: PropTypes.array,
  onCreatePluginFromSuggestion: PropTypes.func.isRequired
};

PluginFormFields.defaultProps = {
  disableId: false,
  pluginSuggestions: []
};

SuggestionCloud.propTypes = {
  query: PropTypes.string,
  suggestions: PropTypes.array,
  onPick: PropTypes.func.isRequired
};

SuggestionCloud.defaultProps = {
  query: '',
  suggestions: []
};

RegistryModal.propTypes = {
  title: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  submitLabel: PropTypes.string.isRequired,
  isSubmitting: PropTypes.bool,
  children: PropTypes.node.isRequired
};

RegistryModal.defaultProps = {
  isSubmitting: false
};

export default AdminPluginManagerSection;

function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute('hidden'));
}
