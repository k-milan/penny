import { Dog } from 'lucide-react';
import type { LucideProps } from 'lucide-react';

export default function AppLogoIcon({ className, ...props }: LucideProps) {
    return <Dog className={className} aria-hidden {...props} />;
}
