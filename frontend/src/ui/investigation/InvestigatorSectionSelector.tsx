export type InvestigatorSection = Readonly<{
  id: string;
  label: string;
  disabled?: boolean;
  description?: string;
}>;

type InvestigatorSectionSelectorProps = Readonly<{
  sections: ReadonlyArray<InvestigatorSection>;
  activeSection: string;
  onChange: (sectionId: string) => void;
}>;

export function InvestigatorSectionSelector({ sections, activeSection, onChange }: InvestigatorSectionSelectorProps) {
  return (
    <div className="investigator-section-selector">
      <nav aria-label="Investigation sections" className="investigator-section-selector__nav">
        {sections.map((section) => (
          <button
            type="button"
            key={section.id}
            className={section.id === activeSection ? 'investigator-section-selector__button is-active' : 'investigator-section-selector__button'}
            aria-current={section.id === activeSection ? 'page' : undefined}
            disabled={section.disabled}
            onClick={() => onChange(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>
      <label className="investigator-section-selector__mobile">
        <span>Investigation section</span>
        <select value={activeSection} onChange={(event) => onChange(event.target.value)}>
          {sections.map((section) => <option key={section.id} value={section.id} disabled={section.disabled}>{section.label}</option>)}
        </select>
      </label>
    </div>
  );
}
