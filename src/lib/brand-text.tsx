import { cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react';

const plainTextElements = new Set(['code', 'pre', 'kbd', 'svg', 'script', 'style', 'textarea']);

export function formatBrandText(text: string): ReactNode {
  const parts = text.split(/(\barmoreum\b)/gi);
  if (parts.length === 1) return text;

  return <>{parts.map((part, index) =>
    <Fragment key={`brand-part-${index}`}>
      {/^\barmoreum\b$/i.test(part)
        ? <strong><em className="brand-name">armoreum</em></strong>
        : part}
    </Fragment>
  )}</>;
}

export function formatBrandNode(node: ReactNode): ReactNode {
  if (typeof node === 'string') return formatBrandText(node);
  if (Array.isArray(node)) return <>{node.map((child, index) =>
    <Fragment key={isValidElement(child) && child.key !== null ? String(child.key) : `formatted-child-${index}`}>
      {formatBrandNode(child)}
    </Fragment>
  )}</>;
  if (!isValidElement(node)) return node;

  if (typeof node.type === 'string' && plainTextElements.has(node.type.toLowerCase())) return node;
  const props = node.props as { children?: ReactNode };
  if (props.children === undefined) return node;
  if (node.type === Fragment) return <>{formatBrandNode(props.children)}</>;

  return cloneElement(
    node as ReactElement<{ children?: ReactNode }>,
    undefined,
    formatBrandNode(props.children),
  );
}

export function BrandTextTree({ children }: { children: ReactNode }) {
  return <>{formatBrandNode(children)}</>;
}
