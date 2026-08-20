/**
 * Which component serves which tool slug, for the route generator.
 *
 * The one place that mapping exists now that each tool has its own route. A
 * slug missing here fails `pnpm routes` loudly rather than producing a page
 * with no tool on it.
 */
export interface WidgetComponent {
  name: string;
  from: string;
  /** JSX props, for a widget parameterised by its slug. */
  props?: string;
  /** An extra import line those props need. */
  extraImport?: string;
}

export const WIDGET_COMPONENTS: Record<string, WidgetComponent> = {
  "chmod-calculator": {
    "name": "ChmodCalculator",
    "from": "@/components/tools/widgets/chmod-calculator"
  },
  "regex-tester": {
    "name": "RegexTester",
    "from": "@/components/tools/widgets/regex-tester"
  },
  "html-entity-converter": {
    "name": "EntityConverter",
    "from": "@/components/tools/widgets/entity-converter"
  },
  "pdf-to-text": {
    "name": "PdfToText",
    "from": "@/components/tools/widgets/pdf-to-text"
  },
  "pdf-to-images": {
    "name": "PdfToImages",
    "from": "@/components/tools/widgets/pdf-to-images"
  },
  "image-resizer": {
    "name": "ImageResizer",
    "from": "@/components/tools/widgets/image-resizer"
  },
  "qr-code-generator": {
    "name": "QrGenerator",
    "from": "@/components/tools/widgets/qr-generator"
  },
  "percentage-calculator": {
    "name": "PercentageCalculator",
    "from": "@/components/tools/widgets/percentage-calculator"
  },
  "loan-calculator": {
    "name": "LoanCalculator",
    "from": "@/components/tools/widgets/loan-calculator"
  },
  "word-counter": {
    "name": "WordCounter",
    "from": "@/components/tools/widgets/word-counter"
  },
  "case-converter": {
    "name": "CaseConverter",
    "from": "@/components/tools/widgets/case-converter"
  },
  "text-diff-checker": {
    "name": "TextDiff",
    "from": "@/components/tools/widgets/text-diff"
  },
  "json-formatter": {
    "name": "JsonFormatter",
    "from": "@/components/tools/widgets/json-formatter"
  },
  "base64-encoder-decoder": {
    "name": "Base64Converter",
    "from": "@/components/tools/widgets/base64-converter"
  },
  "hash-generator": {
    "name": "HashGenerator",
    "from": "@/components/tools/widgets/hash-generator"
  },
  "url-encoder-decoder": {
    "name": "UrlEncoder",
    "from": "@/components/tools/widgets/url-encoder"
  },
  "jwt-decoder": {
    "name": "JwtDecoder",
    "from": "@/components/tools/widgets/jwt-decoder"
  },
  "password-generator": {
    "name": "PasswordGenerator",
    "from": "@/components/tools/widgets/password-generator"
  },
  "csv-to-json-converter": {
    "name": "CsvJsonConverter",
    "from": "@/components/tools/widgets/csv-json-converter"
  },
  "aspect-ratio-calculator": {
    "name": "AspectRatioCalculator",
    "from": "@/components/tools/widgets/aspect-ratio-calculator"
  },
  "srt-to-vtt": {
    "name": "SubtitleConverter",
    "from": "@/components/tools/widgets/subtitle-converter"
  },
  "uuid-generator": {
    "name": "UuidGenerator",
    "from": "@/components/tools/widgets/uuid-generator"
  },
  "timestamp-converter": {
    "name": "TimestampConverter",
    "from": "@/components/tools/widgets/timestamp-converter"
  },
  "cron-explainer": {
    "name": "CronExplainer",
    "from": "@/components/tools/widgets/cron-explainer"
  },
  "number-base-converter": {
    "name": "NumberBaseConverter",
    "from": "@/components/tools/widgets/number-base-converter"
  },
  "lorem-ipsum-generator": {
    "name": "LoremGenerator",
    "from": "@/components/tools/widgets/lorem-generator"
  },
  "line-cleaner": {
    "name": "LineCleaner",
    "from": "@/components/tools/widgets/line-cleaner"
  },
  "date-difference": {
    "name": "DateDifference",
    "from": "@/components/tools/widgets/date-difference"
  },
  "data-size-converter": {
    "name": "DataSizeConverter",
    "from": "@/components/tools/widgets/data-size-converter"
  },
  "image-converter": {
    "name": "ImageConverter",
    "from": "@/components/tools/widgets/image-converter",
    "props": "{...CONVERSIONS[\"image-converter\"]} ",
    "extraImport": "import { CONVERSIONS } from \"@/lib/tools/image/spec\";"
  }
};
