import { Fragment, useState } from 'react';
import PropTypes from 'prop-types';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card.jsx';
import Button from '../../../atoms/Button.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../../ui/dialog.jsx';
import { Input } from '../../../ui/input.jsx';
import { Textarea } from '../../../ui/textarea.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../../../ui/table.jsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../../../ui/alert-dialog.jsx';

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
  const [deleteTarget, setDeleteTarget] = useState(null);

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
          <CardAction>
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
          </CardAction>
        </CardHeader>
        <CardContent>
          {pluginsQuery.isLoading ? (
            <p className="card__meta">Loading plugins…</p>
          ) : pluginsQuery.isError ? (
            <Card className="card--error">
              <CardContent>
                <p>{pluginsQuery.error?.message ?? 'Failed to load plugins.'}</p>
              </CardContent>
            </Card>
          ) : (
            <Table aria-label="Plugin manager">
              <TableHeader>
                <TableRow>
                  <TableHead>Plugin</TableHead>
                  <TableHead>Namespaces</TableHead>
                  <TableHead>Asset hints</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managedPlugins.map((plugin) => {
                  const isEditing = editingPluginId === plugin.id;
                  return (
                    <Fragment key={plugin.id}>
                      <TableRow key={plugin.id}>
                        <TableCell className="align-top">
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
                        </TableCell>
                        <TableCell>{plugin.namespaces?.length ?? 0}</TableCell>
                        <TableCell>{plugin.assetHints?.length ?? 0}</TableCell>
                        <TableCell>
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
                              onClick={() => setDeleteTarget(plugin)}
                              disabled={deletePluginMutation.isPending}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isEditing ? (
                        <TableRow key={`${plugin.id}-editor`}>
                          <TableCell colSpan={4}>
                            <div className="registry-inline-editor">
                              <p className="card__meta">Editing {plugin.id}</p>
                              <PluginFormFields
                                pluginDraft={pluginDraft}
                                setPluginDraft={setPluginDraft}
                                disableId
                              />
                              <div className="button-group registry-inline-editor__actions">
                                <Button type="button" size="sm" onClick={onPluginSave} disabled={updatePluginPending}>
                                  {updatePluginPending ? 'Saving…' : 'Save changes'}
                                </Button>
                                <Button type="button" size="sm" variant="ghost" onClick={onPluginReset}>
                                  Cancel
                                </Button>
                              </div>
                              {pluginSaveError ? <p className="card__meta">{pluginSaveError}</p> : null}
                              {pluginValidationError ? (
                                <p className="card__meta admin-validation-error">{pluginValidationError}</p>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateModal} onOpenChange={(open) => (open ? null : onCloseCreateModal())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add plugin</DialogTitle>
            <DialogDescription>
              Add a registry entry from namespace or asset signals.
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button type="button" size="sm" variant="ghost" onClick={onCloseCreateModal}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={onPluginSave} disabled={createPluginPending}>
              {createPluginPending ? 'Adding…' : 'Add plugin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plugin {deleteTarget?.label ?? ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the registry entry only. It does not delete any detected sites.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deletePluginMutation.mutate(deleteTarget.id);
                }
                setDeleteTarget(null);
              }}
            >
              Delete plugin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
        <Input
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
        <Input
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
        <Textarea
          value={pluginDraft.description}
          onChange={(event) => setPluginDraft((prev) => ({ ...prev, description: event.target.value }))}
        />
      </label>
      <label className="stacked-form__label registry-form-grid__full">
        Plugin URL
        <Input
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
        <Textarea
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
        <Textarea
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
  onCreatePluginFromSuggestion: PropTypes.func
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

export default AdminPluginManagerSection;
