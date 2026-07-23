import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Intro } from "./scenes/Intro";
import { Outro } from "./scenes/Outro";
import { IdeasScene } from "./scenes/IdeasScene";
import { CardStageVertical } from "./components/CardStage";
import { colors, durations } from "./theme";

export const IdeasVertical: React.FC = () => {
  const { intro, ideas, outro } = durations;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <Sequence durationInFrames={intro}>
        <Intro logoSize={84} />
      </Sequence>

      <Sequence from={intro} durationInFrames={ideas}>
        <CardStageVertical
          headline="Pide ideas virales a tu IA"
          cardWidth={1000}
          cardHeight={900}
        >
          <IdeasScene />
        </CardStageVertical>
      </Sequence>

      <Sequence from={intro + ideas}>
        <Outro logoSize={78} />
      </Sequence>
    </AbsoluteFill>
  );
};
