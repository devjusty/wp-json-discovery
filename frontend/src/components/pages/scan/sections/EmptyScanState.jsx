import { Card, CardContent } from '@/components/ui/card.jsx';

function EmptyScanState() {
  return (
    <Card role="status" aria-label="Scan prompt" className="card card--info">
      <CardContent>
        <p>
          Enter a domain to discover available REST endpoints, review core
          content, and detect themes and plugins.
        </p>
      </CardContent>
    </Card>
  );
}

export default EmptyScanState;
