declare module 'react-simple-maps' {
  import type { ComponentType, CSSProperties, ReactNode, MouseEvent } from 'react'

  export interface GeographyStyle {
    default?: CSSProperties
    hover?: CSSProperties
    pressed?: CSSProperties
  }

  export const ComposableMap: ComponentType<{
    projection?: string
    projectionConfig?: { scale?: number; center?: [number, number] }
    width?: number
    height?: number
    style?: CSSProperties
    children?: ReactNode
  }>

  export const ZoomableGroup: ComponentType<{
    center?: [number, number]
    zoom?: number
    children?: ReactNode
  }>

  export const Geographies: ComponentType<{
    geography: string
    children: (data: {
      geographies: Array<{
        rsmKey: string
        properties: { name: string; [key: string]: unknown }
      }>
    }) => ReactNode
  }>

  export const Geography: ComponentType<{
    geography: unknown
    style?: GeographyStyle
    onMouseEnter?: (event: MouseEvent) => void
    onMouseMove?: (event: MouseEvent) => void
    onMouseLeave?: () => void
    onClick?: (event: MouseEvent) => void
  }>
}
