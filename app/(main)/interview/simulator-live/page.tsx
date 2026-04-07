"use client";

import LocalInterviewSimulator from "../_components/local-interview-simulator";

export default function VoiceInterviewSimulatorPage() {
  return (
    <LocalInterviewSimulator initialMode="voice" showModeToggle={false} />
  );
}
