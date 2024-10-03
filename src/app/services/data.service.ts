// src/app/services/data.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import proj4 from 'proj4';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private dataUrl = 'assets/data.json';

  constructor(private http: HttpClient) {}

  getProcessedData(): Observable<any> {
    return this.http.get<any>(this.dataUrl).pipe(
      map(data => {
        const proj3857 = 'EPSG:3857';
        const proj4326 = 'EPSG:4326';

        proj4.defs(proj3857, '+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +ellps=WGS84 +units=m +no_defs');
        proj4.defs(proj4326, '+proj=longlat +datum=WGS84 +no_defs');

        data.features = data.features.map((feature: any) => {
          if (feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates = feature.geometry.coordinates.map((polygon: any) =>
              polygon.map((ring: any) =>
                ring.map((coord: number[]) => {
                  if (!Array.isArray(coord) || coord.length < 2) {
                    console.warn('Invalid coordinate structure:', coord);
                    return [0, 0];
                  }

                  const [x, y] = coord;

                  if (!isFinite(x) || !isFinite(y)) {
                    console.warn('Non-finite coordinate values:', coord);
                    return [0, 0];
                  }

                  return proj4(proj3857, proj4326, [x, y]);
                })
              )
            );
          } else if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates = feature.geometry.coordinates.map((ring: any) =>
              ring.map((coord: number[]) => {
                if (!Array.isArray(coord) || coord.length < 2) {
                  console.warn('Invalid coordinate structure:', coord);
                  return [0, 0];
                }

                const [x, y] = coord;

                if (!isFinite(x) || !isFinite(y)) {
                  console.warn('Non-finite coordinate values:', coord);
                  return [0, 0];
                }

                return proj4(proj3857, proj4326, [x, y]);
              })
            );
          } else {
            console.warn('Unsupported geometry type:', feature.geometry.type);
          }

          return feature;
        });

        return data;
      })
    );
  }
}
