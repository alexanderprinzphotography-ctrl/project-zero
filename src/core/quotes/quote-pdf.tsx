import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatCentsAsEuro } from "@/core/money/cents";
import { decimalNumberToHundredths, hundredthsToQuantityInputValue } from "@/core/money/quote-math";
import type { Quote, QuoteItem } from "@/core/quotes/quote";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  logo: { width: 120, height: 60, objectFit: "contain" },
  companyName: { fontSize: 14, fontWeight: 700 },
  metaBlock: { alignItems: "flex-end" },
  addressBlock: { marginBottom: 24 },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  introText: { marginBottom: 16, lineHeight: 1.4 },
  table: { display: "flex", width: "100%", marginBottom: 16 },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingBottom: 4,
    marginBottom: 4,
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
    paddingVertical: 4,
  },
  colPos: { width: "6%" },
  colName: { width: "38%" },
  colQty: { width: "12%", textAlign: "right", paddingRight: 6 },
  colUnit: { width: "10%" },
  colPrice: { width: "17%", textAlign: "right" },
  colTotal: { width: "17%", textAlign: "right" },
  totalsBlock: { alignItems: "flex-end", marginTop: 8 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", width: 200, marginBottom: 2 },
  totalsRowBold: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 200,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#333",
    fontWeight: 700,
    fontSize: 11,
  },
  closingText: { marginTop: 24, lineHeight: 1.4 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: "#ccc",
    paddingTop: 8,
    fontSize: 8,
    color: "#666",
    textAlign: "center",
  },
});

function formatGermanDate(value: string): string {
  return new Date(value).toLocaleDateString("de-DE", { timeZone: "UTC" });
}

export type QuotePdfCustomer = {
  type: "privat" | "gewerblich";
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
};

export type QuotePdfCompany = {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
};

function customerAddressLines(customer: QuotePdfCustomer): string[] {
  const lines: string[] = [];
  if (customer.type === "gewerblich" && customer.company_name) {
    lines.push(customer.company_name);
    const personName = [customer.first_name, customer.last_name].filter(Boolean).join(" ");
    if (personName) lines.push(personName);
  } else {
    const personName = [customer.first_name, customer.last_name].filter(Boolean).join(" ");
    lines.push(personName || customer.company_name || "");
  }
  if (customer.street) lines.push(customer.street);
  const cityLine = [customer.postal_code, customer.city].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);
  return lines.filter(Boolean);
}

export function QuotePdfDocument({
  quote,
  items,
  customer,
  company,
}: {
  quote: Quote;
  items: QuoteItem[];
  customer: QuotePdfCustomer;
  company: QuotePdfCompany;
}) {
  const accentColor = company.primaryColor || "#1d4ed8";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {company.logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image hat kein alt-Attribut
              <Image src={company.logoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.companyName}>{company.name}</Text>
            )}
          </View>
          <View style={styles.metaBlock}>
            <Text style={{ fontWeight: 700, color: accentColor }}>Angebot #{quote.quote_number}</Text>
            <Text>Datum: {formatGermanDate(quote.quote_date)}</Text>
            <Text>Gültig bis: {formatGermanDate(quote.valid_until)}</Text>
          </View>
        </View>

        <View style={styles.addressBlock}>
          {customerAddressLines(customer).map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
        </View>

        <Text style={styles.title}>Angebot #{quote.quote_number}</Text>
        {quote.intro_text && <Text style={styles.introText}>{quote.intro_text}</Text>}

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.colPos}>Pos.</Text>
            <Text style={styles.colName}>Bezeichnung</Text>
            <Text style={styles.colQty}>Menge</Text>
            <Text style={styles.colUnit}>Einheit</Text>
            <Text style={styles.colPrice}>Einzelpreis</Text>
            <Text style={styles.colTotal}>Gesamt</Text>
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colPos}>{item.position}</Text>
              <Text style={styles.colName}>{item.name}</Text>
              <Text style={styles.colQty}>
                {hundredthsToQuantityInputValue(decimalNumberToHundredths(Number(item.quantity)))}
              </Text>
              <Text style={styles.colUnit}>{item.unit}</Text>
              <Text style={styles.colPrice}>{formatCentsAsEuro(item.unit_price_net_cents)}</Text>
              <Text style={styles.colTotal}>{formatCentsAsEuro(item.line_total_net_cents)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text>Netto</Text>
            <Text>{formatCentsAsEuro(quote.net_total_cents)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>MwSt ({quote.tax_rate} %)</Text>
            <Text>{formatCentsAsEuro(quote.tax_total_cents)}</Text>
          </View>
          <View style={styles.totalsRowBold}>
            <Text>Brutto</Text>
            <Text>{formatCentsAsEuro(quote.gross_total_cents)}</Text>
          </View>
        </View>

        {quote.closing_text && <Text style={styles.closingText}>{quote.closing_text}</Text>}

        <Text style={styles.footer}>{company.name}</Text>
      </Page>
    </Document>
  );
}
