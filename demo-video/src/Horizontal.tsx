import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Intro } from "./scenes/Intro";
import { Outro } from "./scenes/Outro";
import { CrearScene } from "./scenes/CrearScene";
import { PublicarScene } from "./scenes/PublicarScene";
import { CardStageHorizontal } from "./components/CardStage";
import { colors, durations } from "./theme";

export const Horizontal: React.FC = () => {
  const { intro, crear, publicar } = durations;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <Sequence durationInFrames={intro}>
        <Intro logoSize={90} />
      </Sequence>

      <Sequence from={intro} durationInFrames={crear}>
        <CardStageHorizontal
          headline="Convierte una idea en guion viral"
          subheadline="Chatea con la IA y sal con un hook, guion y CTA listos para grabar."
          cardWidth={1120}
          cardHeight={880}
        >
          <CrearScene />
        </CardStageHorizontal>
      </Sequence>

      <Sequence from={intro + crear} durationInFrames={publicar}>
        <CardStageHorizontal
          headline="Publica en TikTok e Instagram a la vez"
          subheadline="Una publicación, todas tus redes. Programa o publica al instante."
          cardWidth={1120}
          cardHeight={880}
        >
          <PublicarScene />
        </CardStageHorizontal>
      </Sequence>

      <Sequence from={intro + crear + publicar}>
        <Outro logoSize={84} />
      </Sequence>
    </AbsoluteFill>
  );
};
