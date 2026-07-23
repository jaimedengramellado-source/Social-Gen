import React from "react";
import { Composition } from "remotion";
import "./style.css";
import { Vertical } from "./Vertical";
import { Horizontal } from "./Horizontal";
import { IdeasVertical } from "./IdeasVertical";
import { HookCard } from "./templates/HookCard";
import { ListCard } from "./templates/ListCard";
import { FPS, totalFrames, totalIdeasFrames } from "./theme";

const hookCardDefaults = {
  hook: "Copié la rutina matutina de un piloto de la Marina. El día 4 casi vomito.",
  handle: "@socialflamingo",
};

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Vertical"
        component={Vertical}
        durationInFrames={totalFrames}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="Horizontal"
        component={Horizontal}
        durationInFrames={totalFrames}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="IdeasVertical"
        component={IdeasVertical}
        durationInFrames={totalIdeasFrames}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="HookCard6s"
        component={HookCard}
        durationInFrames={6 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={hookCardDefaults}
      />
      <Composition
        id="HookCard15s"
        component={HookCard}
        durationInFrames={15 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={hookCardDefaults}
      />
      {/* Composiciones del generador de animaciones de la app (ver worker.ts):
          la duración la deciden los props que llegan de video_renders. */}
      <Composition
        id="TplHookCard"
        component={HookCard}
        durationInFrames={6 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ ...hookCardDefaults, durationInSeconds: 6 }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.round((props.durationInSeconds ?? 6) * FPS),
        })}
      />
      <Composition
        id="TplListCard"
        component={ListCard}
        durationInFrames={10 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{
          title: "3 errores que matan tus vídeos",
          items: [
            "Empezar con una intro de 20 segundos",
            "No poner subtítulos",
            "Pedir el like antes de dar valor",
          ],
          handle: "@socialflamingo",
          durationInSeconds: 10,
        }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.round((props.durationInSeconds ?? 10) * FPS),
        })}
      />
    </>
  );
};
