import AccountController from '@/actions/App/Http/Controllers/AccountController';
import AllocationController from '@/actions/App/Http/Controllers/AllocationController';
import BillTrackerController from '@/actions/App/Http/Controllers/BillTrackerController';
import IncomeTemplateController from '@/actions/App/Http/Controllers/IncomeTemplateController';
import TransactionController from '@/actions/App/Http/Controllers/TransactionController';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import {
    Banknote,
    CalendarCheck,
    LayoutGrid,
    Receipt,
    Target,
    Wallet,
} from 'lucide-react';
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Transactions',
        href: TransactionController.index(),
        icon: Receipt,
    },
    {
        title: 'Bill tracker',
        href: BillTrackerController.index(),
        icon: CalendarCheck,
    },
    {
        title: 'Accounts',
        href: AccountController.index(),
        icon: Wallet,
    },
    {
        title: 'Allocations',
        href: AllocationController.index(),
        icon: Target,
    },
    {
        title: 'Incomes',
        href: IncomeTemplateController.index(),
        icon: Banknote,
    },
];

export function AppSidebar() {
    return (
        <Sidebar collapsible="icon" variant="sidebar">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
