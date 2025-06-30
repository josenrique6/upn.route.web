import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import polyline from '@mapbox/polyline';
import flatpickr from 'flatpickr';
import 'leaflet/dist/leaflet.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'flatpickr/dist/flatpickr.min.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import '../assets/css/custom.css';
import { useNavigate } from 'react-router-dom';
import 'leaflet-draw';                   // plugin de dibujo para Leaflet
import * as turf from '@turf/turf';      // para el buffer

// Componente del Mapa y funcionalidad de rutas
export default function Optimizer () {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersRef = useRef([]);
  const locationsRef = useRef([]);
  const depotIndexRef = useRef(0);
  //const [truckConfigOpen, setTruckConfigOpen] = useState(false);
  const [optimizationError, setOptimizationError] = useState(null);
  // Estado para pegar/parsear JSON de camiones
  const [trucksJSON, setTrucksJSON] = useState("");
  const [trucksData, setTrucksData] = useState([]); // array de objetos { id, capacity, axleload, ... }
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Estado para el JSON de entregas
  const [deliveriesJSON, setDeliveriesJSON] = useState("");
  const [deliveriesData, setDeliveriesData] = useState([]); // array de objetos de entrega
  const deliveriesDataRef = useRef([]);
  const infoControlRef = useRef(null);
  const legendControlRef = useRef(null);

  const truckColors = [
    "#62a0ca", // azul suave
    "#ffa656", // naranja suave
    "#6cbc6c", // verde suave
    "#e26868", // rojo suave
    "#b494d1", // morado suave
    "#ae8881", // marrón suave
    "#eca0d4", // rosa suave
    "#a6a6a6", // gris suave
  ];

  // Carga y dibuja las entregas (markers) + actualiza la lista a la izquierda
  const loadDeliveries = () => {
    try {
      const parsed = JSON.parse(deliveriesJSON);
      if (!Array.isArray(parsed)) {
        alert("El JSON de entregas debe ser un arreglo de objetos.");
        return;
      }

      // Limpiamos marcadores existentes (si ya había marcadores en el mapa)
      clearMarkers();

      // Reiniciamos los arreglos
      markersRef.current = [];
      locationsRef.current = [];

      // Guardamos el arreglo completo de entregas (para usar más tarde en la lista)
      setDeliveriesData(parsed);
      deliveriesDataRef.current = parsed;

      // Recorremos cada objeto de entrega y creamos un marker
      parsed.forEach((entrega, idx) => {
        // Extraer long/lati de strings a numbers
        const lng = parseFloat(entrega.coordinates[0]);
        const lat = parseFloat(entrega.coordinates[1]);

        // Creamos un marker arrastrable
        const marker = L.marker([lat, lng], {
          draggable: true,
          icon: L.divIcon({
          html: `<div class="custom-html-icon-div" style="background: #4c4cff;">
                  <div class="custom-html-icon-txt">${idx + 1}</div>
                </div>`,
            iconSize: [30, 30],
            className: "",
          }),
        })
          .addTo(leafletMapRef.current)
          .bindPopup(`Entrega ID: <b>${entrega.id}</b>`);

        // Evento para “click derecho” y eliminar marcador
        marker.on("contextmenu", () => {
          leafletMapRef.current.removeLayer(marker);
          const i = markersRef.current.indexOf(marker);
          if (i > -1) {
            markersRef.current.splice(i, 1);
            locationsRef.current.splice(i, 1);
            setDeliveriesData((prev) => {
              const newArr = [...prev];
              newArr.splice(i, 1);
              deliveriesDataRef.current = newArr;
              return newArr;
            });
            updateLocationList();
            updateLocationInput();
            updateMarkers();
          }
        });

        // Evento para “dragend” y actualizar posición
        marker.on("dragend", (e) => {
          const { lat: newLat, lng: newLng } = e.target.getLatLng();
          const i = markersRef.current.indexOf(marker);
          locationsRef.current[i] = [newLng, newLat];

          // Actualizar también deliveriesData[i].coordinates
          setDeliveriesData((prev) => {
            const newArr = [...prev];
            if (newArr[i]) {
              newArr[i].coordinates = [newLng.toString(), newLat.toString()];
            }
            deliveriesDataRef.current = newArr;
            return newArr;
          });
          updateLocationList();
          updateLocationInput();
        });

        // Guardar en los refs
        markersRef.current.push(marker);
        locationsRef.current.push([lng, lat]);
      });

      // Ajustar el mapa para que se vea todo
      const allPoints = locationsRef.current.map(([lng, lat]) => [lat, lng]);
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        leafletMapRef.current.fitBounds(bounds);
      }

      // Actualizamos lista y el input de ubicaciones
      updateLocationList();
      updateLocationInput();
    } catch (err) {
      alert("JSON de entregas inválido: " + err.message);
    }
  };

  // Actualiza el campo de ubicaciones (texto) con las coordenadas actuales
  const updateLocationInput = () => {
    const input = document.getElementById("locations");
    if (input) {
      input.value = locationsRef.current
        .map((loc) => `${loc[1]},${loc[0]}`)
        .join("; ");
    }
  };

  // Actualiza la numeración de los marcadores (cuando se eliminan o reordenan)
  const updateMarkers = () => {
    markersRef.current.forEach((marker, i) => {
      marker.setIcon(
        L.divIcon({
          html: `<div class="custom-html-icon-div"><div class="custom-html-icon-txt">${i + 1}</div></div>`,
          iconSize: [30, 30],
          className: "",
        })
      );
    });
  };

  /*const secondsToTime = (seconds) => {
    let hrs = Math.floor(seconds / 3600);
    let mins = Math.floor((seconds % 3600) / 60);
    let secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const timeToSeconds = (timeStr) => {
    const parts = timeStr.split(":");
    if (parts.length !== 3) return 0;
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  };

  const getDepartureSeconds = () => {
    const startHour = parseInt(document.getElementById('startHour')?.value || 0);
    const startMinute = parseInt(document.getElementById('startMinute')?.value || 0);
    return startHour * 3600 + startMinute * 60;
  };*/

  // Muestra el listado de ubicaciones en el panel izquierdo, usando deliveriesData para mostrar IDs
  const updateLocationList = () => {
    const listContainer = document.getElementById("locationsList");
    if (!listContainer) return;
    listContainer.innerHTML = "";

    locationsRef.current.forEach((loc, i) => {
      let li = document.createElement("li");
      li.classList.add("list-group-item", "d-flex", "justify-content-between", "align-items-center");
      li.style.cursor = "pointer";

      // Mostramos el índice y el ID de entrega si existe
      const entrega = deliveriesData[i];
      const texto = entrega
        ? `${i + 1}. ID: ${entrega.id} (${parseFloat(loc[1]).toFixed(6)}, ${parseFloat(loc[0]).toFixed(6)})`
        : `${i + 1}. (${parseFloat(loc[1]).toFixed(6)}, ${parseFloat(loc[0]).toFixed(6)})`;

      li.innerHTML = `<span>${texto}</span>
        <button type="button" class="btn btn-sm btn-outline-danger">&times;</button>`;

      // Al hacer clic en el texto del li, centramos el mapa en ese punto
      li.addEventListener("click", (e) => {
        // Si el clic es sobre el botón de eliminar, no centramos
        if (e.target.tagName === "BUTTON") return;
        const [lng, lat] = locationsRef.current[i];
        leafletMapRef.current.setView([lat, lng], 13, { animate: true });
        markersRef.current[i].openPopup();
      });

      // Botón eliminar en la lista
      const btnEliminar = li.querySelector("button");
      btnEliminar.addEventListener("click", (ev) => {
        ev.stopPropagation();
        // Equivalente a un contextmenu en el marcador
        leafletMapRef.current.removeLayer(markersRef.current[i]);
        markersRef.current.splice(i, 1);
        locationsRef.current.splice(i, 1);
        setDeliveriesData((prev) => {
          const newArr = [...prev];
          newArr.splice(i, 1);
          deliveriesDataRef.current = newArr;
          return newArr;
        });
        updateMarkers();
        updateLocationList();
        updateLocationInput();
      });

      listContainer.appendChild(li);
    });

    // Inicializa flatpickr en los inputs de ventana horaria (si los tuvieras)
    flatpickr(".timepicker", {
      enableTime: true,
      noCalendar: true,
      dateFormat: "H:i:S",
      time_24hr: true
    });
  };

  const clearMarkers = () => {
    markersRef.current.forEach((marker) => leafletMapRef.current.removeLayer(marker));
    markersRef.current = [];
    locationsRef.current = [];
    depotIndexRef.current = 0;
    setDeliveriesData([]);
    deliveriesDataRef.current = [];
    updateLocationInput();
    updateLocationList();
  };

  const formatTimeReadable = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    let result = [];
    if (hours > 0) result.push(`${hours} h`);
    if (minutes > 0) result.push(`${Math.round(minutes)} min`);
    if (secs > 0 || result.length === 0)
      result.push(`${Math.round(secs)} s`);
    return result.join(" ");
  };

  const optimizeRoute = () => {
    setOptimizationError(null);
    setSuccessMessage("");
    setLoading(true);
    if (locationsRef.current.length === 0) {
      alert("Selecciona al menos una ubicación en el mapa.");
      setLoading(false);
      return;
    }

    if (trucksData.length === 0) {
      alert("Debes cargar al menos un camión en el JSON de flota.");
      setLoading(false);
      return;
    }

    const roundTrip = document.getElementById('roundTrip')?.checked;
    const optimizeBy = document.getElementById('optimizeBy')?.value;
    const startHour = parseInt(document.getElementById('startHour')?.value || 0);
    const startMinute = parseInt(document.getElementById('startMinute')?.value || 0);

    const startDate = new Date();
    startDate.setHours(startHour, startMinute, 0, 0);

    // Construir el array de ubicaciones:
    const payloadLocations = locationsRef.current.map((loc, idx) => {
      const locObj = {
        id: deliveriesData[idx]?.id.toString(),
        coordinates: [loc[0].toString(), loc[1].toString()],
        service_time: 1000,
        weight_kg: deliveriesData[idx]?.weight_kg || 0,
        volume_m3: deliveriesData[idx]?.volume_m3 || 0,
        priority: deliveriesData[idx]?.priority || "baja",
      };
      if (loc.timeWindow) {
        locObj.time_window = loc.timeWindow;
      }
      return locObj;
    });

    const payload = {
      round_trip: roundTrip,
      optimize_by: optimizeBy,
      depot_index: depotIndexRef.current,
      locations: payloadLocations,
      start_hour: startHour,
      start_minute: startMinute,
      start_datetime: startDate.toISOString(),
      trucks: trucksData.map((tr) => ({
        id: tr.id,
        capacity: tr.capacity,
        axleload: tr.axleload,
        height: tr.height,
        length: tr.length,
        weight: tr.weight,
        width: tr.width,
        hazmat: tr.hazmat,
      })),
    };

    fetch("http://localhost:8000/api/v1/optimize/route", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"/*,
        "Authorization": `Bearer ${token}`*/
      },
      body: JSON.stringify(payload),
    })
      .then((response) => {
        if (!response.ok) {
          if (response.status === 401) {
            setOptimizationError("No autorizado. Por favor, cierra sesión e inicia nuevamente.");
            throw new Error("No autorizado. Por favor, cierra sesión e inicia nuevamente.");
          }
          if (response.status === 404) {
            setOptimizationError("No se encontró ruta. Verificar los datos ingresados.");
            throw new Error("No se encontró ruta. Verificar los datos ingresados.");
          }
          throw new Error("Error al consultar la API de optimización");
        }
        return response.json();
      })
      .then((data) => {
        if (!data.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
          setOptimizationError("No se encontraron rutas (campo 'routes'). Verificar los datos ingresados.");
          console.error("Error: data.routes no está definido o está vacío");
          return;
        }

        // Limpiar capas anteriores (líneas/segmentos) sin tocar los marcadores
        leafletMapRef.current.eachLayer((layer) => {
          if (layer instanceof L.Polyline || layer instanceof L.Circle) {
            leafletMapRef.current.removeLayer(layer);
          }
        });

        // Para cada ruta (vehículo) en data.routes:
        data.routes.forEach((vehRoute, vehIdx) => {
          const { route_nodes, route_segments, route_geometry } = vehRoute;

          // 1) Actualizar los colores de los marcadores de este vehículo
          route_nodes.forEach((nodeIndex, i) => {
            let color;
            if (i === 0) {
              color = "#6cbc6c"; // verde suave
            } else if (i === route_nodes.length - 1) {
              color = "#e26868"; // rojo suave
            } else {
              color = truckColors[vehIdx % truckColors.length];
            }
            markersRef.current[nodeIndex].setIcon(
              L.divIcon({
                html: `<div class="custom-html-icon-div" style="background: ${color};">
                        <div class="custom-html-icon-txt">${i + 1}</div>
                      </div>`,
                iconSize: [30, 30],
                className: "",
              })
            );
          });

          // 2) Dibujar la geometría completa de la ruta (opcional)
          if (route_geometry) {
            const decodedFull = polyline.decode(route_geometry).map((c) => [c[0], c[1]]);
            L.polyline(decodedFull, {
              color: truckColors[vehIdx % truckColors.length],
              weight: 4,
              opacity: 0.5,
            }).addTo(leafletMapRef.current);
          }

          // 3) Dibujar cada segmento con color “más oscuro”
          route_segments.forEach((segment) => {
            const decodedCoords = polyline.decode(segment.polyline).map((coord) => [coord[0], coord[1]]);
            L.polyline(decodedCoords, {
              color: "#fff",
              weight: 9,
              opacity: 1,
            }).addTo(leafletMapRef.current);
            L.polyline(decodedCoords, {
              color: truckColors[vehIdx % truckColors.length],
              weight: 6,
              opacity: 1,
            }).addTo(leafletMapRef.current).bindPopup(`
              <b>${formatTimeReadable(vehRoute.vehicle_duration)}</b><br>
              <span>${Math.round(vehRoute.vehicle_distance / 1000)} km</span><br>
              <small>Camión: ${vehRoute.vehicle_id}</small>
            `);
          });
        });

        // Ajustar bounds para encuadrar todas las rutas
        const allPoints = data.routes.flatMap((vehRoute) =>
          vehRoute.route_nodes.map((idx) => [
            locationsRef.current[idx][1],
            locationsRef.current[idx][0],
          ])
        );
        if (allPoints.length > 0) {
          const bounds = L.latLngBounds(allPoints);
          leafletMapRef.current.fitBounds(bounds);
        }
        // **ACTUALIZA EL PANEL FLOTANTE**
        if (infoControlRef.current) {
          infoControlRef.current.update(data);
        }
        setSuccessMessage("Optimización completada con éxito");
      })
      .catch((error) => {
        console.error("Error en la optimización", error);
        setOptimizationError("Ocurrió un error al optimizar la ruta");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Función para cerrar sesión: remueve el token y redirige a /login
  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  useEffect(() => {
    if (!leafletMapRef.current) {
      const map = L.map(mapRef.current).setView([-12.0464, -77.0428], 13);
      leafletMapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      // Control resumen de ruta
      infoControlRef.current = L.control({ position: 'topright' });
      infoControlRef.current.onAdd = function() {
        const container = L.DomUtil.create('div', 'info-panel leaflet-control');
        // inline styles para evitar desborde
        Object.assign(container.style, {
          maxHeight: '260px',
          width: '220px',
          overflowY: 'auto',
          background: 'rgba(255,255,255,0.95)',
          padding: '8px',
          borderRadius: '4px',
          boxShadow: '0 1px 5px rgba(0,0,0,0.4)',
          fontSize: '13px',
          lineHeight: '1.2',
          zIndex: 1000
        });
        this._container = container;
        this.update();
        return container;
      };
      infoControlRef.current.update = function(data) {
        if (!data) {
          this._container.innerHTML = '<h4>Resumen de ruta</h4><p>Cargando…</p>';
          return;
        }
        const km = (data.total_distance / 1000).toFixed(1);
        const mins = (data.total_duration / 60).toFixed(1);
        const list = data.routes
          .map((route, rIdx) => {
            const items = route.route_nodes
              .map((nodeIdx, idx) => {
                let color = '#000';
                const marker = markersRef.current[nodeIdx];
                if (marker) {
                  const html = marker.options?.icon?.options?.html || '';
                  const match = html.match(/background:\s*([^;]+);/);
                  if (match) color = match[1];
                }
                const pointId = deliveriesDataRef.current[nodeIdx]?.id || nodeIdx;
                let etaTime = '';
                if (Array.isArray(data.etas)) {
                  const etaObj = data.etas.find((e) => e.point_id.toString() === pointId.toString());
                  if (etaObj) {
                    etaTime = new Date(etaObj.eta_formatted).toLocaleTimeString();
                  }
                }
                return `<li style="list-style:none;display:flex;align-items:center;">
                          <span style="background:${color};width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:4px;"></span>
                          <span style="margin-right:4px;">${idx + 1}.</span>
                          <strong>${pointId}</strong>${etaTime ? `: ${etaTime}` : ''}
                        </li>`;
              })
              .join('');
            const distKm = (route.vehicle_distance / 1000).toFixed(1);
            const durMin = (route.vehicle_duration / 60).toFixed(1);
            return `<div style="margin-bottom:6px;">
                      <strong>Ruta ${rIdx + 1} (${route.vehicle_id})</strong>
                      <div style="font-size:12px;margin-bottom:2px;">
                        ${distKm} km – ${durMin} min
                      </div>
                      <ul style="padding-left:0;margin:2px 0 0;">${items}</ul>
                    </div>`;
          })
          .join('');
        this._container.innerHTML = `
          <h4 style="margin:0 0 6px;">Resumen de ruta</h4>
          <p style="margin:0 0 8px;"><strong>Distancia:</strong> ${km} km<br>
             <strong>Duración:</strong> ${mins} min</p>
          <div>${list}</div>
        `;
      };
      infoControlRef.current.addTo(map);

      // Control de leyenda
      legendControlRef.current = L.control({ position: 'bottomright' });
      legendControlRef.current.onAdd = function() {
        const div = L.DomUtil.create('div', 'legend leaflet-control');
        Object.assign(div.style, {
          maxHeight: '300px',
          width: '200px',
          overflowY: 'auto',
          background: 'rgba(255,255,255,0.95)',
          padding: '8px',
          borderRadius: '4px',
          boxShadow: '0 1px 5px rgba(0,0,0,0.4)',
          fontSize: '13px',
          lineHeight: '1.2',
          zIndex: 1000
        });
        div.innerHTML = `
          <h4 style="margin:0 0 6px;">Marcadores</h4>
          <div class="legend-item"><span class="legend-color blue"></span> Entrega</div>
          <div class="legend-item"><span class="legend-color" style="background:#2ca02c"></span> Inicio</div>
          <div class="legend-item"><span class="legend-color" style="background:#d62728"></span> Fin</div>
        `;
        return div;
      };
      legendControlRef.current.addTo(map);

      // 1. Grupo donde se guardarán los trazados
      const drawLayer = new L.FeatureGroup();
      map.addLayer(drawLayer);

      // 2. Control de dibujo (solo polyline)
      const drawControl = new L.Control.Draw({
        edit: { featureGroup: drawLayer },
        draw: {
          polygon: false,
          marker: false,
          rectangle: false,
          circle: false,
          circlemarker: false,
          polyline: {
            shapeOptions: { color: 'red', weight: 4 }
          }
        }
      });
      map.addControl(drawControl);

      // 3. Evento al terminar de dibujar
      map.on(L.Draw.Event.CREATED, (e) => {
        const layer = e.layer;
        drawLayer.addLayer(layer);

        if (e.layerType === 'polyline') {
          // Extraemos coords [lng,lat]
          const coords = layer.getLatLngs().map(p => [p.lng, p.lat]);

          // Hacemos buffer de 50 m (0.05 km)
          const line = turf.lineString(coords);
          const buffered = turf.buffer(line, 0.015, { units: 'kilometers' });

          // Pintamos el polígono de prueba
          L.polygon(buffered.geometry.coordinates, {
            color: '#000', weight: 2, dashArray: '4,6'
          }).addTo(map);

          console.log('POLYGON_COORDINATES =', JSON.stringify(buffered.geometry.coordinates));
        }
      });

      // Al hacer clic en el mapa, agregamos un marcador “a mano”
      /*map.on("click", function(e) {
        const lat = e.latlng.lat.toFixed(6);
        const lng = e.latlng.lng.toFixed(6);
        const marker = L.marker([lat, lng], {
          draggable: true,
          icon: L.divIcon({
            html: `<div class="custom-html-icon-div">${markersRef.current.length + 1}</div>`,
            iconSize: [30, 30],
            className: "",
          }),
        })
          .bindPopup(`Ubicación: ${lat}, ${lng} <br><small>(Haz clic derecho para eliminar)</small>`)
          .addTo(map);

        marker.on("contextmenu", function() {
          map.removeLayer(marker);
          const index = markersRef.current.indexOf(marker);
          if (index > -1) {
            markersRef.current.splice(index, 1);
            locationsRef.current.splice(index, 1);
            if (depotIndexRef.current === index) depotIndexRef.current = 0;
            updateLocationList();
            updateMarkers();
            updateLocationInput();
          }
        });

        marker.on("dragend", function(event) {
          const newLat = event.target.getLatLng().lat.toFixed(6);
          const newLng = event.target.getLatLng().lng.toFixed(6);
          const index = markersRef.current.indexOf(marker);
          locationsRef.current[index] = [newLng, newLat];
          updateLocationInput();
          updateLocationList();
        });

        markersRef.current.push(marker);
        locationsRef.current.push([lng, lat]);
        updateMarkers();
        updateLocationInput();
        updateLocationList();
      });*/
    }
  }, []);

  return (
    <div className="container-fluid full-vh">
      {loading && (
        <div className="loading-overlay">
          <div className="spinner-border text-primary" role="status" />
        </div>
      )}
      <div className="row full-height">
        {/* Panel izquierdo: parámetros + listado de entregas */}
        <div className="col-12 col-md-3 bg-light left-panel overflow-auto p-4 d-flex flex-column" style={{ zoom: "80%" }}>
          <h2 className="mb-3">Optimización de Rutas</h2>

          <div className="mb-3">
            <label htmlFor="optimizeBy" className="form-label">Optimizar por:</label>
            <select id="optimizeBy" name="optimizeBy" className="form-select">
              <option value="time" defaultValue>Tiempo</option>
              <option value="distance">Distancia</option>
            </select>
          </div>

          {/* Otras opciones (ruta cerrada, optimizar por, hora) */}
          <div className="mb-3 form-check">
            <input type="checkbox" id="roundTrip" name="roundTrip" className="form-check-input" />
            <label htmlFor="roundTrip" className="form-check-label">Ruta Cerrada (Round Trip)</label>
          </div>

          <div className="row g-2 mb-3">
            <div className="col-6">
              <label htmlFor="startHour" className="form-label">Hora de Salida</label>
              <input type="number" className="form-control" id="startHour" min="0" max="23" defaultValue="12" />
            </div>
            <div className="col-6">
              <label htmlFor="startMinute" className="form-label">Minuto de Salida</label>
              <input type="number" className="form-control" id="startMinute" min="0" max="59" defaultValue="00" />
            </div>
          </div>

          {/* Sección para cargar entregas */}
          <div className="row g-2 mb-2">
            <h6 className="mt-2">Cargar Entregas (JSON)</h6>
            <div className="col-12 mb-2">
              <textarea
                className="form-control"
                rows={6}
                placeholder={`Ejemplo:\n[\n  {\n    "id": "17890",\n    "coordinates": ["-77.03789187","-12.09514075"],\n    "service_time": 600,\n    "priority": "media",\n    "volume_m3": 0.004469,\n    "weight_kg": 3.0204\n  },\n  {\n    "id": "17888",\n    "coordinates": ["-77.02338520","-12.08745600"],\n    "service_time": 600,\n    "priority": "alta",\n    "volume_m3": 0.041208,\n    "weight_kg": 25.1364\n  }\n]`}
                value={deliveriesJSON}
                onChange={(e) => setDeliveriesJSON(e.target.value)}
              ></textarea>
              <button
                className="btn btn-sm btn-outline-secondary mt-1 mb-3"
                onClick={loadDeliveries}
              >
                Cargar Entregas
              </button>
            </div>
          </div>

          <div id="truckConfig" className="mb-3">
            <div className="row g-2 mb-3">
              <h6 className="mt-2">Configuración del Camión</h6>
               <div className="col-12 mb-2">
                 <label className="form-label">JSON de Camiones (flota)</label>
                 <textarea
                   className="form-control"
                   rows={6}
                   placeholder={`Ejemplo:\n[\n  {\n    "id": "camion1",\n    "capacity": 1000,\n    "axleload": 10,\n    "height": 6,\n    "length": 8.35,\n    "weight": 18,\n    "width": 2.3,\n    "hazmat": false\n  },\n  {\n    "id": "camion2",\n    "capacity": 800,\n    "axleload": 8,\n    "height": 4.2,\n    "length": 6,\n    "weight": 16,\n    "width": 2.5,\n    "hazmat": true\n  }\n]`}
                   value={trucksJSON}
                   onChange={(e) => setTrucksJSON(e.target.value)}
                 ></textarea>
                 <button
                   className="btn btn-sm btn-outline-secondary mt-1"
                   onClick={() => {
                     try {
                       const parsed = JSON.parse(trucksJSON);
                       if (!Array.isArray(parsed)) {
                         alert("El JSON debe ser un arreglo de objetos de camión.");
                         return;
                       }
                       for (let cam of parsed) {
                         if (!cam.id || typeof cam.capacity !== "number") {
                           alert("Cada camión necesita al menos 'id' y 'capacity'.");
                           return;
                         }
                       }
                       setTrucksData(parsed);
                     } catch (err) {
                       alert("JSON inválido: " + err.message);
                     }
                   }}
                 >
                   Cargar Camiones
                 </button>
               </div>
            </div>
          </div>

          {optimizationError && (
            <div className="alert alert-danger" role="alert">
              {optimizationError}
            </div>
          )}
          {successMessage && (
            <div className="alert alert-success" role="alert">
              {successMessage}
            </div>
          )}

          {/* Botones de acción */}
          <div className="mb-3">
            <button onClick={optimizeRoute} className="btn btn-primary me-2" disabled={loading}>
              {loading && (
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              )}
              {loading ? 'Optimizando...' : 'Optimizar Ruta'}
            </button>
            <button onClick={clearMarkers} className="btn btn-secondary">
              Limpiar Ubicaciones
            </button>
          </div>
          <div className='row'>
            <div className='col-12'>
              {/* Listado de ubicaciones/entregas cargadas */}
              <h4>Listado de Entregas</h4>
              <ul id="locationsList" className="list-group flex-grow-1 overflow-auto" style={{ maxHeight: "600px" }}></ul>
            </div>
          </div>

        </div>

        {/* Contenedor del mapa */}
        <div className="col-12 col-md-9 map-container">
          <div id="map" ref={mapRef} style={{ height: "100%", width: "100%" }}></div>
        </div>
      </div>
    </div>
  );
};