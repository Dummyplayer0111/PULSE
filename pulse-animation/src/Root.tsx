import React from 'react';
import { Composition } from 'remotion';
import { WorkflowMaster } from './WorkflowMaster';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PayGuardWorkflow"
        component={WorkflowMaster}
        durationInFrames={1200}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
