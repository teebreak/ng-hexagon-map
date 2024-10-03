// src/app/services/data.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import proj4 from 'proj4';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

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
          feature.geometry.coordinates = feature.geometry.coordinates.map((polygon: any[]) =>
            polygon.map((ring: any[]) =>
              ring.map((coord: number[]) => {
                const [x, y] = coord;
                const [lng, lat] = proj4('EPSG:3857', 'EPSG:4326', [x, y]);

                // Maybe I could change it with proj4.defs ...
                return [lat, lng];
              })
            )
          );

          return feature;
        });

        return data;
      }),
    );
  }
}
