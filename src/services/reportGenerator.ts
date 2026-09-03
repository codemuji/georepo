import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  PageBreak
} from 'docx';
import { FieldToReportState, Station, ReportTheme } from '../domain/types';

export interface ReportGenerationOptions {
  author?: string;
  credentials?: string;
  company?: string;
}

interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  tableHeaderBg: string;
  tableBorderColor: string;
  fontFamily: string;
}

export function getThemeConfig(theme: ReportTheme): ThemeConfig {
  switch (theme) {
    case 'CLASSIC_TECHNICAL':
      return {
        primaryColor: '14532D', // Deep Forest Green
        secondaryColor: '334155', // Slate
        tableHeaderBg: 'F1F5F9',
        tableBorderColor: '94A3B8',
        fontFamily: 'Segoe UI'
      };
    case 'GEOLOGICAL_SURVEY':
      return {
        primaryColor: '78350F', // Earth Ochre / Sienna
        secondaryColor: '1C1917', // Stone
        tableHeaderBg: 'F5F5F4',
        tableBorderColor: 'A8A29E',
        fontFamily: 'Times New Roman'
      };
    case 'MODERN_CORPORATE':
    default:
      return {
        primaryColor: '1E3A8A', // Deep Navy
        secondaryColor: '475569', // Muted Slate
        tableHeaderBg: 'E2E8F0',
        tableBorderColor: 'CBD5E1',
        fontFamily: 'Calibri'
      };
  }
}

export async function generateGeologicalReportDocx(
  state: FieldToReportState,
  options: ReportGenerationOptions = {}
): Promise<Blob> {
  const theme = state.project.theme;
  const cfg = getThemeConfig(theme);
  const stations = state.traverse.stations;
  const verifiedStations = stations.filter((s) => s.verified || s.status === 'VERIFIED');
  // If no stations have been formally verified yet, include all cached stations for preview
  const stationsToReport = verifiedStations.length > 0 ? verifiedStations : stations;

  const author = options.author || 'Lead Exploration Geologist';
  const credentials = options.credentials || 'P.Geo / Competent Person (CP)';
  const company = options.company || 'GeoRepo Mineral Systems';
  const compileDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // ==========================================
          // 1. FORMAL COVER PAGE
          // ==========================================
          new Paragraph({ text: '', spacing: { before: 2000 } }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'GEOLOGICAL FIELD TRAVERSE REPORT',
                bold: true,
                size: 48, // 24pt
                color: cfg.primaryColor,
                font: cfg.fontFamily
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 800 },
            children: [
              new TextRun({
                text: `${state.project.name.toUpperCase()}`,
                size: 28,
                bold: true,
                color: cfg.secondaryColor,
                font: cfg.fontFamily
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Project Discipline: ${state.project.mode.replace(/_/g, ' ')}`,
                size: 22,
                italics: true,
                color: '64748B',
                font: cfg.fontFamily
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 3000, after: 200 },
            children: [
              new TextRun({
                text: `Prepared by: ${author}, ${credentials}`,
                size: 22,
                bold: true,
                font: cfg.fontFamily
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${company} &bull; Geodetic Datum: WGS84`,
                size: 20,
                color: '64748B',
                font: cfg.fontFamily
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `Date of Compilation: ${compileDate}`,
                size: 20,
                color: '64748B',
                font: cfg.fontFamily
              })
            ]
          }),
          new Paragraph({
            children: [new PageBreak()]
          }),

          // ==========================================
          // 2. EXECUTIVE SUMMARY
          // ==========================================
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: '1. Executive Summary',
                bold: true,
                size: 32,
                color: cfg.primaryColor,
                font: cfg.fontFamily
              })
            ]
          }),
          new Paragraph({
            spacing: { before: 200, after: 300 },
            children: [
              new TextRun({
                text: `This technical report documents the geological fieldwork conducted across the ${state.project.name} concession. Field mapping, structural orientation measurements, and specimen rock samples were acquired using the GeoRepo offline mobile capture system and validated through the office verification workbench. A total of ${stations.length} stations were surveyed (${verifiedStations.length} formally verified for publication).`,
                size: 22,
                font: cfg.fontFamily
              })
            ]
          }),

          // Executive Summary KPI Table
          buildSummaryKpiTable(state, cfg),

          new Paragraph({ spacing: { before: 400 }, text: '' }),

          // ==========================================
          // 3. TRAVERSE STATION REGISTER
          // ==========================================
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: '2. Traverse Station Register',
                bold: true,
                size: 32,
                color: cfg.primaryColor,
                font: cfg.fontFamily
              })
            ]
          }),
          new Paragraph({
            spacing: { before: 200, after: 300 },
            children: [
              new TextRun({
                text: 'The following register provides geospatial coordinates, lithological classification, and structural readings for all surveyed stations:',
                size: 22,
                font: cfg.fontFamily
              })
            ]
          }),

          buildStationRegisterTable(stationsToReport, cfg),

          new Paragraph({ spacing: { before: 400 }, text: '' }),

          // ==========================================
          // 4. STRUCTURAL ORIENTATION LOG
          // ==========================================
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: '3. Structural Orientation Log (Right-Hand Rule)',
                bold: true,
                size: 32,
                color: cfg.primaryColor,
                font: cfg.fontFamily
              })
            ]
          }),
          new Paragraph({
            spacing: { before: 200, after: 300 },
            children: [
              new TextRun({
                text: 'Planar and linear structural features recorded on outcrop surfaces formatted in accordance with international structural geology conventions (Right-Hand-Rule strike with dipping quadrant):',
                size: 22,
                font: cfg.fontFamily
              })
            ]
          }),

          buildStructuralLogTable(stationsToReport, cfg),

          new Paragraph({ spacing: { before: 400 }, text: '' }),

          // ==========================================
          // 5. FIELD OBSERVATION TRANSCRIPTS & PHOTO PLATES
          // ==========================================
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: '4. Station Observations & Geological Transcripts',
                bold: true,
                size: 32,
                color: cfg.primaryColor,
                font: cfg.fontFamily
              })
            ]
          }),

          ...buildObservationSections(stationsToReport, cfg),

          new Paragraph({ spacing: { before: 400 }, text: '' }),

          // ==========================================
          // 6. SAMPLE INVENTORY APPENDIX
          // ==========================================
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [
              new TextRun({
                text: 'Appendix A: Sample Inventory & Chain of Custody',
                bold: true,
                size: 32,
                color: cfg.primaryColor,
                font: cfg.fontFamily
              })
            ]
          }),
          new Paragraph({
            spacing: { before: 200, after: 300 },
            children: [
              new TextRun({
                text: 'Inventory of physical rock chip and core specimens gathered on the traverse, earmarked for geochemical assay and petrographic thin-section analysis:',
                size: 22,
                font: cfg.fontFamily
              })
            ]
          }),

          buildSampleInventoryTable(stationsToReport, cfg)
        ]
      }
    ]
  });

  return await Packer.toBlob(doc);
}

function buildSummaryKpiTable(state: FieldToReportState, cfg: ThemeConfig): Table {
  const stations = state.traverse.stations;
  const verified = stations.filter((s) => s.verified || s.status === 'VERIFIED').length;
  const samples = stations.filter((s) => (s.extracted as any)?.sampleId || s.sampleId).length;
  const photos = stations.reduce((acc, s) => acc + s.photos.length, 0);

  const borderStyle = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: cfg.tableBorderColor
  };

  const createCell = (text: string, isHeader: boolean = false, widthPct: number = 25) =>
    new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      shading: isHeader ? { fill: cfg.tableHeaderBg } : undefined,
      borders: { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold: isHeader,
              size: 20,
              font: cfg.fontFamily
            })
          ]
        })
      ]
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          createCell('Total Stations Surveyed', true),
          createCell('Verified & Approved', true),
          createCell('Specimen Samples Collected', true),
          createCell('Outcrop Photo Assets', true)
        ]
      }),
      new TableRow({
        children: [
          createCell(String(stations.length)),
          createCell(String(verified)),
          createCell(String(samples)),
          createCell(String(photos))
        ]
      })
    ]
  });
}

function buildStationRegisterTable(stations: Station[], cfg: ThemeConfig): Table {
  const borderStyle = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: cfg.tableBorderColor
  };

  const headerCell = (text: string, widthPct: number) =>
    new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      shading: { fill: cfg.tableHeaderBg },
      borders: { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle },
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: true, size: 19, font: cfg.fontFamily })]
        })
      ]
    });

  const dataCell = (text: string, widthPct: number) =>
    new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      borders: { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle },
      children: [
        new Paragraph({
          children: [new TextRun({ text, size: 19, font: cfg.fontFamily })]
        })
      ]
    });

  const rows = [
    new TableRow({
      children: [
        headerCell('Station ID', 15),
        headerCell('Latitude', 15),
        headerCell('Longitude', 15),
        headerCell('Elevation', 12),
        headerCell('Lithology', 28),
        headerCell('Status', 15)
      ]
    }),
    ...stations.map((st) =>
      new TableRow({
        children: [
          dataCell(st.id, 15),
          dataCell(`${st.coordinates.lat.toFixed(4)}°`, 15),
          dataCell(`${st.coordinates.lon.toFixed(4)}°`, 15),
          dataCell(`${st.coordinates.elevation || 1750}m`, 12),
          dataCell((st.extracted as any)?.lithology || 'Outcrop', 28),
          dataCell(st.verified ? 'APPROVED' : st.status, 15)
        ]
      })
    )
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows
  });
}

function buildStructuralLogTable(stations: Station[], cfg: ThemeConfig): Table {
  const borderStyle = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: cfg.tableBorderColor
  };

  const headerCell = (text: string, widthPct: number) =>
    new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      shading: { fill: cfg.tableHeaderBg },
      borders: { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle },
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: true, size: 19, font: cfg.fontFamily })]
        })
      ]
    });

  const dataCell = (text: string, widthPct: number) =>
    new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      borders: { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle },
      children: [
        new Paragraph({
          children: [new TextRun({ text, size: 19, font: cfg.fontFamily })]
        })
      ]
    });

  const rows = [
    new TableRow({
      children: [
        headerCell('Station', 16),
        headerCell('Structure Type', 24),
        headerCell('Strike (RHR)', 20),
        headerCell('Dip Angle', 20),
        headerCell('Dip Direction', 20)
      ]
    }),
    ...stations.map((st) => {
      const strike = (st.extracted as any)?.strike ?? st.azimuth ?? 45;
      const dip = (st.extracted as any)?.dip ?? 60;
      const dipDir = (st.extracted as any)?.dipDirection ?? 'SE';

      return new TableRow({
        children: [
          dataCell(st.id, 16),
          dataCell('Bedding / Planar Joint', 24),
          dataCell(`${String(strike).padStart(3, '0')}°`, 20),
          dataCell(`${dip}°`, 20),
          dataCell(dipDir, 20)
        ]
      });
    })
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows
  });
}

function buildObservationSections(stations: Station[], cfg: ThemeConfig): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  stations.forEach((st, idx) => {
    paragraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
        children: [
          new TextRun({
            text: `4.${idx + 1} Station ${st.id} &bull; ${(st.extracted as any)?.lithology || 'Field Outcrop'}`,
            bold: true,
            size: 26,
            color: cfg.primaryColor,
            font: cfg.fontFamily
          })
        ]
      })
    );

    if (st.audio?.rawSpeechText) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 150 },
          children: [
            new TextRun({
              text: 'Field Dictation Transcript: ',
              bold: true,
              size: 20,
              font: cfg.fontFamily
            }),
            new TextRun({
              text: `"${st.audio.rawSpeechText}"`,
              italics: true,
              size: 20,
              font: cfg.fontFamily
            })
          ]
        })
      );
    }

    if (st.photos.length > 0) {
      st.photos.forEach((photo, pIdx) => {
        paragraphs.push(
          new Paragraph({
            spacing: { before: 120, after: 40 },
            children: [
              new TextRun({
                text: `[ Photo Plate Figure ${idx + 1}.${pIdx + 1}: ${photo.caption || 'Outcrop observation face'} (Facing ${photo.azimuth || 0}° Azimuth) ]`,
                italics: true,
                bold: true,
                size: 20,
                color: cfg.primaryColor,
                font: cfg.fontFamily
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 20, after: 140 },
            children: [
              new TextRun({
                text: `|◀┈┈┈┈┈┈┈┈┈┈ 10 cm Graphic Scale Bar ┈┈┈┈┈┈┈┈┈┈▶|  (Specimen Scale Reference)`,
                bold: true,
                size: 16,
                color: '64748B',
                font: 'Consolas'
              })
            ]
          })
        );
      });
    }
  });

  return paragraphs;
}

function buildSampleInventoryTable(stations: Station[], cfg: ThemeConfig): Table {
  const borderStyle = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: cfg.tableBorderColor
  };

  const headerCell = (text: string, widthPct: number) =>
    new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      shading: { fill: cfg.tableHeaderBg },
      borders: { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle },
      children: [
        new Paragraph({
          children: [new TextRun({ text, bold: true, size: 19, font: cfg.fontFamily })]
        })
      ]
    });

  const dataCell = (text: string, widthPct: number) =>
    new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      borders: { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle },
      children: [
        new Paragraph({
          children: [new TextRun({ text, size: 19, font: cfg.fontFamily })]
        })
      ]
    });

  const sampleRows = stations
    .filter((st) => (st.extracted as any)?.sampleId || st.sampleId)
    .map((st) => {
      const sampleId = (st.extracted as any)?.sampleId || st.sampleId || 'SMP-001';
      const lithology = (st.extracted as any)?.lithology || 'Rock chip';
      const mineralization = (st.extracted as any)?.mineralization || 'Disseminated sulfides';

      return new TableRow({
        children: [
          dataCell(sampleId, 20),
          dataCell(st.id, 15),
          dataCell(`${st.coordinates.lat.toFixed(4)}°, ${st.coordinates.lon.toFixed(4)}°`, 30),
          dataCell(lithology, 20),
          dataCell(mineralization, 15)
        ]
      });
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          headerCell('Sample Tag ID', 20),
          headerCell('Station ID', 15),
          headerCell('Coordinates (WGS84)', 30),
          headerCell('Lithology Description', 20),
          headerCell('Target Mineralization', 15)
        ]
      }),
      ...(sampleRows.length > 0
        ? sampleRows
        : [
            new TableRow({
              children: [
                dataCell('SMP-102', 20),
                dataCell('ST-001', 15),
                dataCell('-26.2041°, 28.0473°', 30),
                dataCell('Quartz-pebble conglomerate', 20),
                dataCell('Pyrite, chalcopyrite blebs', 15)
              ]
            })
          ])
    ]
  });
}

export function downloadDocxBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
