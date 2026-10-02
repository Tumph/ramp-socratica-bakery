"use client";

import { viewerFor } from "@/lib/ramp/from-config";
import { RampIcon } from "./RampIcon";
import { useRampConfig } from "./RampConfigProvider";

export function RampTopBar() {
  const { config } = useRampConfig();
  const viewer = viewerFor(config);
  return (
    <div className="rampTopBar">
      <button type="button" className="rampSearch">
        <RampIcon name="search" />
        <span className="rampSearchLabel">Search for anything</span>
        <span className="rampKbd" aria-hidden>⌘</span>
        <span className="rampKbd" aria-hidden>K</span>
      </button>

      <div className="rampTopBarActions">
        <button type="button" className="rampIconBtn" aria-label="Notifications">
          <RampIcon name="bell" />
        </button>
        <button type="button" className="rampIconBtn" aria-label="Create">
          <RampIcon name="plus" />
        </button>
        <button type="button" className="rampIconBtn" aria-label="Help">
          <RampIcon name="help" />
        </button>
        <button type="button" className="rampAvatarBtn" aria-label="Account menu">
          <span className="rampAvatar">{viewer.initials}</span>
          <RampIcon name="chevron-down-12" size={12} />
        </button>
      </div>
    </div>
  );
}
