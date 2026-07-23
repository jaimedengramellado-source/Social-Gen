import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Intro } from "./scenes/Intro";
import { Outro } from "./scenes/Outro";
import { CrearScene } from "./scenes/CrearScene";
import { PublicarScene } from "./scenes/PublicarScene";
import { CardStageVertical } from "./components/CardStage";
import { colors, durations } from "./theme";

export const Vertical: React.FC = () => {
  const { intro, crear, publicar } = durations;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <Sequence durationInFrames={intro}>
        <Intro logoSize={84} />
      </Sequence>

      <Sequence from={intro} durationInFrames={crear}>
        <CardStageVertical
          headline="Convierte una idea en guion viral"
          cardWidth={1000}
          cardHeight={900}
        >
          <CrearScene />
        </CardStageVertical>
      </Sequence>

      <Sequence from={intro + crear} durationInFrames={publicar}>
        <CardStageVertical
          headline="Publica en TikTok e Instagram a la vez"
          cardWidth={1000}
          cardHeight={900}
        >
          <PublicarScene />
        </CardStageVertical>
      </Sequence>

      <Sequence from={intro + crear + publicar}>
        <Outro logoSize={78} />
      </Sequence>
    </AbsoluteFill>
  );
};
