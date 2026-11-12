import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const LABEL_MAX_NODES = 40

// Los tooltips se arman con texto plano (no HTML) para que un nombre raro
// de una instancia importada no pueda inyectar código en la página.
function textTooltip(text) {
  const el = document.createElement('span')
  el.textContent = text
  return el
}

export default function MapView({ instance, route, routeColor }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const fittedForRef = useRef(null)

  useEffect(() => {
    const map = L.map(containerRef.current, { preferCanvas: true }).setView([-12.05, -77.04], 11)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; Colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
      fittedForRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    if (!instance) return

    const nodes = instance.nodes
    const order = new Map()
    if (route) route.forEach((nodeId, pos) => order.set(nodeId, pos))
    const showLabels = Boolean(route) && nodes.length <= LABEL_MAX_NODES

    if (route) {
      const points = route.map((id) => [nodes[id].lat, nodes[id].lon])
      points.push(points[0])
      L.polyline(points, { color: routeColor, weight: 3, opacity: 0.85 }).addTo(layer)
    }

    nodes.forEach((nd, i) => {
      const isDepot = i === 0
      const marker = L.circleMarker([nd.lat, nd.lon], {
        radius: showLabels ? 11 : isDepot ? 9 : 5,
        color: isDepot ? '#7f1d1d' : '#1e3a8a',
        weight: 2,
        fillColor: isDepot ? '#dc2626' : '#3b82f6',
        fillOpacity: 0.95,
      }).addTo(layer)

      if (showLabels) {
        marker.bindTooltip(textTooltip(isDepot ? 'D' : String(order.get(i))), {
          permanent: true,
          direction: 'center',
          className: 'node-label',
        })
      } else {
        const visit = route && order.has(i) && !isDepot ? ` · visita #${order.get(i)}` : ''
        marker.bindTooltip(textTooltip(`${nd.name || `Nodo ${i}`}${visit}`))
      }
    })

    if (fittedForRef.current !== instance.id) {
      map.fitBounds(L.latLngBounds(nodes.map((nd) => [nd.lat, nd.lon])), { padding: [30, 30] })
      fittedForRef.current = instance.id
    }
  }, [instance, route, routeColor])

  return <div ref={containerRef} className="map" />
}
