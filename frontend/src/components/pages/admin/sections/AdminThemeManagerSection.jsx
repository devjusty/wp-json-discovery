import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader } from '../../../atoms/Card.jsx';
import Button from '../../../atoms/Button.jsx';

function AdminThemeManagerSection({
  sortThemesMutation,
  themesQuery,
  managedThemes,
  themeDraft,
  setThemeDraft,
  editingThemeId,
  createThemePending,
  updateThemePending,
  onThemeSave,
  onThemeReset,
  themeValidationError,
  themeSaveError,
  onOpenCreateModal,
  showCreateModal,
  onCloseCreateModal,
  startEditingTheme,
  deleteThemeMutation
}) {
  const isSaving = createThemePending || updateThemePending;

  return (
    <section className="section">
      <Card>
        <CardHeader>
          <div>
            <h2 id="admin-theme-manager-main">Theme manager</h2>
            <p className="card__meta">
              Add, edit, or remove themes in the Turso-backed theme registry.
            </p>
          </div>
          <div className="card__actions">
            <Button type="button" size="sm" onClick={onOpenCreateModal}>
              Add theme
            </Button>
            <span className="tooltip">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => sortThemesMutation.mutate()}
                disabled={sortThemesMutation.isPending || themesQuery.isLoading}
              >
                {sortThemesMutation.isPending ? 'Sorting…' : 'Sort themes'}
              </Button>
              <span className="tooltip__content">
                Alphabetize theme entries by label.
              </span>
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {themesQuery.isLoading ? (
            <p className="card__meta">Loading themes…</p>
          ) : themesQuery.isError ? (
            <div className="card card--error">
              <div className="card__content">
                <p>{themesQuery.error?.message ?? 'Failed to load themes.'}</p>
              </div>
            </div>
          ) : (
            <div className="admin-table admin-table--theme-manager">
              <div className="admin-table__header">
                <span>Theme</span>
                <span>Paths</span>
                <span>Namespaces</span>
                <span>Actions</span>
              </div>
              {managedThemes.map((theme) => {
                const isEditing = editingThemeId === theme.id;
                return (
                  <div key={theme.id} className="admin-table__row admin-table__row--expandable">
                    <span className="admin-table__cell admin-table__cell--expand">
                      <strong>{theme.label}</strong>
                      <div className="muted">{theme.id}</div>
                      {theme.themeUrl ? (
                        <div>
                          <a href={theme.themeUrl} target="_blank" rel="noreferrer">
                            Docs
                          </a>
                        </div>
                      ) : null}
                      <div className="muted">{theme.description || 'No description'}</div>
                    </span>
                    <span>{theme.pathSignals?.length ?? 0}</span>
                    <span>{theme.namespaceHints?.length ?? 0}</span>
                    <span>
                      <div className="button-group">
                        <Button
                          type="button"
                          size="sm"
                          variant={isEditing ? 'secondary' : 'ghost'}
                          onClick={() => {
                            if (isEditing) {
                              onThemeReset();
                            } else {
                              startEditingTheme(theme);
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
                            if (window.confirm(`Delete theme "${theme.label}"?`)) {
                              deleteThemeMutation.mutate(theme.id);
                            }
                          }}
                          disabled={deleteThemeMutation.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </span>
                    {isEditing ? (
                      <div className="admin-table__details">
                        <p className="card__meta">Editing {theme.id}</p>
                        <div className="registry-inline-editor">
                          <ThemeFormFields
                            themeDraft={themeDraft}
                            setThemeDraft={setThemeDraft}
                            disableId
                          />
                          <div className="button-group registry-inline-editor__actions">
                            <Button type="button" size="sm" onClick={onThemeSave} disabled={isSaving}>
                              {updateThemePending ? 'Saving…' : 'Save changes'}
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={onThemeReset}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                        {themeSaveError ? <p className="card__meta">{themeSaveError}</p> : null}
                        {themeValidationError ? (
                          <p className="card__meta admin-validation-error">{themeValidationError}</p>
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
          title="Add theme"
          onClose={onCloseCreateModal}
          onSubmit={onThemeSave}
          submitLabel={createThemePending ? 'Adding…' : 'Add theme'}
          isSubmitting={createThemePending}
        >
          <ThemeFormFields
            themeDraft={themeDraft}
            setThemeDraft={setThemeDraft}
            disableId={false}
          />
          {themeSaveError ? <p className="card__meta">{themeSaveError}</p> : null}
          {themeValidationError ? (
            <p className="card__meta admin-validation-error">{themeValidationError}</p>
          ) : null}
        </RegistryModal>
      ) : null}
    </section>
  );
}

function ThemeFormFields({ themeDraft, setThemeDraft, disableId }) {
  return (
    <div className="registry-form-grid">
      <label className="stacked-form__label">
        ID
        <input
          type="text"
          value={themeDraft.id}
          onChange={(event) => setThemeDraft((prev) => ({ ...prev, id: event.target.value }))}
          disabled={disableId}
          required
        />
      </label>
      <label className="stacked-form__label">
        Label
        <input
          type="text"
          value={themeDraft.label}
          onChange={(event) => setThemeDraft((prev) => ({ ...prev, label: event.target.value }))}
          required
        />
      </label>
      <label className="stacked-form__label registry-form-grid__full">
        Description
        <textarea
          value={themeDraft.description}
          onChange={(event) => setThemeDraft((prev) => ({ ...prev, description: event.target.value }))}
        />
      </label>
      <label className="stacked-form__label registry-form-grid__full">
        Theme URL
        <input
          type="url"
          value={themeDraft.themeUrl}
          onChange={(event) => setThemeDraft((prev) => ({ ...prev, themeUrl: event.target.value }))}
          placeholder="https://wordpress.org/themes/..."
        />
      </label>
      <label className="stacked-form__label">
        Namespace hints (comma or newline separated)
        <textarea
          value={themeDraft.namespaceHints}
          onChange={(event) => setThemeDraft((prev) => ({ ...prev, namespaceHints: event.target.value }))}
          placeholder="astra-theme-css"
        />
      </label>
      <label className="stacked-form__label">
        Path signals (comma or newline separated)
        <textarea
          value={themeDraft.pathSignals}
          onChange={(event) => setThemeDraft((prev) => ({ ...prev, pathSignals: event.target.value }))}
          placeholder="/wp-content/themes/astra"
        />
      </label>
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

AdminThemeManagerSection.propTypes = {
  sortThemesMutation: PropTypes.shape({
    mutate: PropTypes.func.isRequired,
    isPending: PropTypes.bool
  }).isRequired,
  themesQuery: PropTypes.shape({
    isLoading: PropTypes.bool,
    isError: PropTypes.bool,
    error: PropTypes.object
  }).isRequired,
  managedThemes: PropTypes.array,
  themeDraft: PropTypes.shape({
    id: PropTypes.string,
    label: PropTypes.string,
    description: PropTypes.string,
    themeUrl: PropTypes.string,
    namespaceHints: PropTypes.string,
    pathSignals: PropTypes.string
  }).isRequired,
  setThemeDraft: PropTypes.func.isRequired,
  editingThemeId: PropTypes.string,
  createThemePending: PropTypes.bool,
  updateThemePending: PropTypes.bool,
  onThemeSave: PropTypes.func.isRequired,
  onThemeReset: PropTypes.func.isRequired,
  themeValidationError: PropTypes.string,
  themeSaveError: PropTypes.string,
  onOpenCreateModal: PropTypes.func.isRequired,
  showCreateModal: PropTypes.bool,
  onCloseCreateModal: PropTypes.func.isRequired,
  startEditingTheme: PropTypes.func.isRequired,
  deleteThemeMutation: PropTypes.shape({
    mutate: PropTypes.func.isRequired,
    isPending: PropTypes.bool
  }).isRequired
};

AdminThemeManagerSection.defaultProps = {
  managedThemes: [],
  editingThemeId: null,
  createThemePending: false,
  updateThemePending: false,
  themeValidationError: '',
  themeSaveError: '',
  showCreateModal: false
};

ThemeFormFields.propTypes = {
  themeDraft: PropTypes.object.isRequired,
  setThemeDraft: PropTypes.func.isRequired,
  disableId: PropTypes.bool
};

ThemeFormFields.defaultProps = {
  disableId: false
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

export default AdminThemeManagerSection;

function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute('hidden'));
}
