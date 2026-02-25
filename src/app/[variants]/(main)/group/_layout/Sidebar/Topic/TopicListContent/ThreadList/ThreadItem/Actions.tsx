import { type DropdownItem } from '@lobehub/ui';
import { ActionIcon, DropdownMenu } from '@lobehub/ui';
import { MoreHorizontalIcon } from 'lucide-react';
import { memo, useMemo, useState } from 'react';

import { useServerConfigStore } from '@/store/serverConfig';

interface ActionProps {
  dropdownMenu: DropdownItem[] | (() => DropdownItem[]);
}

const Actions = memo<ActionProps>(({ dropdownMenu }) => {
  const mobile = useServerConfigStore((s) => s.isMobile);
  const [open, setOpen] = useState(false);

  const portalContainer = useMemo(() => {
    if (typeof document === 'undefined' || !mobile || !open) return undefined;

    const drawerContainers = document.querySelectorAll<HTMLElement>('.ant-drawer-content-wrapper');
    const topDrawerContainer = drawerContainers.item(drawerContainers.length - 1) ?? undefined;

    return topDrawerContainer?.querySelector<HTMLElement>('.ant-drawer-section') ?? topDrawerContainer;
  }, [mobile, open]);

  return (
    <DropdownMenu
      items={dropdownMenu}
      open={open}
      portalProps={portalContainer ? { container: portalContainer } : undefined}
      onOpenChange={setOpen}
    >
      <ActionIcon icon={MoreHorizontalIcon} size={'small'} />
    </DropdownMenu>
  );
});

export default Actions;
