import { Link } from 'wouter';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import { BrandTextTree } from '@/lib/brand-text';
import { ArmoreumLogoImages } from '@/components/armoreum-logo-images';

export default function NotFound() {
  return (
    <BrandTextTree><div className="not-found-page">
      <div className="not-found-card">
        <span className="not-found-mark armoreum-logo-mark"><ArmoreumLogoImages /></span>
        <div className="not-found-heading"><CircleAlert size={22} /><h1>This page couldn’t be found.</h1></div>
        <p>The address may have changed, or the requested page may not exist. Your wallet and assets have not been connected or affected.</p>
        <Link href="/" className="button button-primary" data-testid="link-not-found-home"><ArrowLeft size={15} /> Return to armoreum</Link>
      </div>
    </div></BrandTextTree>
  );
}
