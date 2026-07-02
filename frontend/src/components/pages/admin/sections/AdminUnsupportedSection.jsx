import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader } from '@/components/ui/card.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select.jsx';
import Button from '../../../atoms/Button.jsx';
import TextInput from '../../../atoms/TextInput.jsx';
import { Badge } from '../../../ui/badge.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../../../ui/table.jsx';
import { namespaceToSlug } from '../drafts.js';
import { formatFullTimestamp, formatShortDate } from '../utils.js';

function AdminUnsupportedSection({
  unsupportedEntries,
  unsupportedNamespacePrefix,
  setUnsupportedNamespacePrefix,
  unsupportedSort,
  setUnsupportedSort,
  filteredUnsupportedEntries,
  unknownPluginAssetHints,
  onCreatePluginFromAsset,
  onCreatePluginFromSuggestion
}) {
  return (
    <section className="section">
      <Card>
        <CardHeader>
          <div>
            <h2 id="admin-unsupported-main">Unsupported plugins</h2>
            <p className="card__meta">Current registry with domains and timestamps.</p>
          </div>
        </CardHeader>
        <CardContent>
          <p className="card__meta">
            Namespace-based unsupported plugins and homepage asset-only plugin signals are tracked separately.
          </p>

          <h3>Asset-only plugin signals</h3>
          {unknownPluginAssetHints.length ? (
            <Table aria-label="Asset-only plugin signals">
              <TableHeader>
                <TableRow>
                  <TableHead>Plugin slug</TableHead>
                  <TableHead>Occurrences</TableHead>
                  <TableHead>Paths</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unknownPluginAssetHints.map((asset) => (
                  <TableRow key={asset.slug}>
                    <TableCell className="font-medium">{asset.slug}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{asset.occurrences}</Badge>
                    </TableCell>
                    <TableCell>{asset.pathCount}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onCreatePluginFromAsset(asset.slug)}
                      >
                        Create plugin entry
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="card__meta">No unknown plugin asset signals currently detected.</p>
          )}

          <h3 className="section-heading-spaced">Namespace unsupported plugins</h3>
          {unsupportedEntries.length ? (
            <>
              <div className="admin-filters">
                <label className="admin-filter-field">
                  Namespace prefix
                  <TextInput
                    type="text"
                    value={unsupportedNamespacePrefix}
                    onChange={(event) => setUnsupportedNamespacePrefix(event.target.value)}
                    placeholder="e.g. wc/"
                  />
                </label>
                <label className="admin-filter-field">
                  Sort
                  <Select value={unsupportedSort} onValueChange={setUnsupportedSort}>
                    <SelectTrigger aria-label="Sort">
                      <SelectValue placeholder="Last seen (newest)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lastSeenDesc">Last seen (newest)</SelectItem>
                      <SelectItem value="domainsDesc">Most domains</SelectItem>
                      <SelectItem value="namespaceAsc">Namespace (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>
              <Table aria-label="Namespace unsupported plugins">
                <TableHeader>
                  <TableRow>
                    <TableHead>Namespace</TableHead>
                    <TableHead>Domains</TableHead>
                    <TableHead>First seen</TableHead>
                    <TableHead>Last seen</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnsupportedEntries.map((plugin) => (
                    <TableRow key={plugin.namespace}>
                      <TableCell className="font-medium">{plugin.namespace}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{plugin.domains?.length ?? 0}</Badge>
                      </TableCell>
                      <TableCell className="tooltip">
                        {formatShortDate(plugin.firstDetectedAt)}
                        <span className="tooltip__content">
                          {formatFullTimestamp(plugin.firstDetectedAt) || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="tooltip">
                        {formatShortDate(plugin.lastDetectedAt)}
                        <span className="tooltip__content">
                          {formatFullTimestamp(plugin.lastDetectedAt) || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={`Promote ${plugin.namespace}`}
                          onClick={() => onCreatePluginFromSuggestion({
                            kind: 'namespace',
                            namespace: plugin.namespace,
                            slug: namespaceToSlug(plugin.namespace)
                          })}
                        >
                          Promote
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!filteredUnsupportedEntries.length ? (
                <p className="card__meta">No unsupported namespaces match this filter.</p>
              ) : null}
            </>
          ) : (
            <p className="card__meta">No unsupported plugins recorded.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

AdminUnsupportedSection.propTypes = {
  unsupportedEntries: PropTypes.array,
  unsupportedNamespacePrefix: PropTypes.string.isRequired,
  setUnsupportedNamespacePrefix: PropTypes.func.isRequired,
  unsupportedSort: PropTypes.string.isRequired,
  setUnsupportedSort: PropTypes.func.isRequired,
  filteredUnsupportedEntries: PropTypes.array,
  unknownPluginAssetHints: PropTypes.array,
  onCreatePluginFromAsset: PropTypes.func.isRequired,
  onCreatePluginFromSuggestion: PropTypes.func.isRequired
};

AdminUnsupportedSection.defaultProps = {
  unsupportedEntries: [],
  filteredUnsupportedEntries: [],
  unknownPluginAssetHints: []
};

export default AdminUnsupportedSection;
