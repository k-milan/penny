import type { LucideProps } from 'lucide-react';
import { Dog } from 'lucide-react';

export default function AppLogoIcon({ className, ...props }: LucideProps) {
    return <Dog className={className} aria-hidden {...props} />;
}
