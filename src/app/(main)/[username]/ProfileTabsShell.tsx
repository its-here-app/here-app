"use client";

import type { ReactNode } from "react";
import { Tabs, Tab } from "@/components/ui/Tabs";
import { List } from "@/components/ui/icons/List";
import { Map } from "@/components/ui/icons/Map";
import { Spots } from "@/components/ui/icons/Spots";

interface Props {
  children: ReactNode;
}

export default function ProfileTabsShell({ children }: Props) {
  return (
    <div className="mt-4 lg:mt-16">
      <Tabs className="mb-6">
        <Tab title="—" active icon={<List />} />
        <Tab title="—" icon={<Map />} />
        <Tab title="—" icon={<Spots />} />
      </Tabs>
      {children}
    </div>
  );
}
