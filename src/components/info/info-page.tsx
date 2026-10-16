import { Link } from 'wouter';
import { ArrowRight, ArrowUpRight, CircleAlert, Info } from 'lucide-react';
import { BrandTextTree, formatBrandText } from '@/lib/brand-text';
import type { InfoBlock, InfoLink, InfoPageDef, InfoSectionDef } from './types';
import './info-page.css';

export function InfoLinkItem({ link, className }: { link: InfoLink; className?: string }) {
  return link.external
    ? <a className={className} href={link.href} target="_blank" rel="noopener noreferrer">{formatBrandText(link.label)}<ArrowUpRight size={14} aria-hidden="true" /></a>
    : <Link className={className} href={link.href}>{formatBrandText(link.label)}<ArrowRight size={14} aria-hidden="true" /></Link>;
}

export function InfoBlocks({ blocks }: { blocks: InfoBlock[] }) {
  return <BrandTextTree>{blocks.map((b, i) => <div className="ip-block" key={i}>
    {b.p && <p className="ip-p">{b.p}</p>}
    {b.ul && <ul className="ip-list">{b.ul.map((x) => <li key={x}>{x}</li>)}</ul>}
    {b.steps && <ol className="ip-steps">{b.steps.map((s, n) => <li key={s.title}><span className="ip-step-no">{String(n + 1).padStart(2, '0')}</span><div><strong>{s.title}</strong><p>{s.text}</p></div></li>)}</ol>}
    {b.cards && <div className="ip-cards">{b.cards.map((c) => <article className="ip-card" key={c.title}>{c.tag && <span className="ip-tag">{c.tag}</span>}<h3>{c.title}</h3><p>{c.text}</p></article>)}</div>}
    {b.table && <div className="ip-table-wrap" role="region" aria-label={b.table.label} tabIndex={0}><table className="ip-table"><thead><tr>{b.table.headers.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{b.table.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => ci === 0 ? <th scope="row" key={ci}>{c}</th> : <td key={ci}>{c}</td>)}</tr>)}</tbody></table></div>}
    {b.callout && <aside className={`ip-callout ${b.callout.tone || 'note'}`}>{b.callout.tone === 'warn' ? <CircleAlert size={18} aria-hidden="true" /> : <Info size={18} aria-hidden="true" />}<div><strong>{b.callout.title}</strong><p>{b.callout.text}</p></div></aside>}
    {b.links && <ul className="ip-links">{b.links.map((l) => <li key={l.href + l.label}><InfoLinkItem link={l} className="ip-link" />{l.note && <span>{l.note}</span>}</li>)}</ul>}
  </div>)}</BrandTextTree>;
}

export function InfoSections({ sections }: { sections: InfoSectionDef[] }) {
  return <>{sections.map((s, i) => <section className="ip-section" id={s.id} key={s.id} aria-labelledby={`${s.id}-h`}>
    <div className="ip-section-head"><span className="ip-section-no">{s.kicker || String(i + 1).padStart(2, '0')}</span><h2 id={`${s.id}-h`}>{formatBrandText(s.title)}</h2></div>
    <InfoBlocks blocks={s.blocks} />
  </section>)}</>;
}

export function InfoPage({ def, testId }: { def: InfoPageDef; testId: string }) {
  const Icon = def.icon;
  return <BrandTextTree><article className="ip-page" data-testid={testId} aria-labelledby="ip-title">
    <header className="ip-hero">
      <div className="ip-hero-copy">
        <span className="ip-eyebrow"><Icon size={15} aria-hidden="true" />{def.eyebrow}</span>
        <h1 id="ip-title">{def.title}</h1>
        <p className="ip-lead">{def.lead}</p>
      </div>
      {def.evidence && <dl className="ip-evidence" aria-label="Evidence summary">{def.evidence.map((e) => <div key={e.label}><dt>{e.label}</dt><dd>{e.value}</dd></div>)}</dl>}
    </header>
    <div className="ip-layout">
      <nav className="ip-toc" aria-label="On this page"><span>On this page</span><ol>{def.sections.map((s) => <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>)}</ol></nav>
      <div className="ip-body">
        <InfoSections sections={def.sections} />
        {def.cta && <section className="ip-cta" aria-label={def.cta.title}>
          <div><h2>{def.cta.title}</h2><p>{def.cta.text}</p></div>
          <div className="ip-cta-actions">
            <Link href={def.cta.href} className="button button-primary ip-cta-main" data-testid="link-info-cta">{def.cta.label}<ArrowRight size={15} aria-hidden="true" /></Link>
            {def.cta.secondary && <InfoLinkItem link={def.cta.secondary} className="button button-secondary" />}
          </div>
        </section>}
      </div>
    </div>
  </article></BrandTextTree>;
}
