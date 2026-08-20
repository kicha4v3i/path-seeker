/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'plotly.js/dist/plotly' {
  const Plotly: {
    relayout: (
      root: HTMLElement,
      update: Record<string, unknown>,
    ) => Promise<HTMLElement>
  }
  export default Plotly
}

declare module 'react-plotly.js' {
  import { Component } from 'react'
  import { PlotParams } from 'plotly.js'
  export default class Plot extends Component<Partial<PlotParams>> {}
}
