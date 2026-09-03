import { describe, expect, it } from "vitest";
import { Badge } from "../../../src/design/components/Badge";
import { Button } from "../../../src/design/components/Button";
import { Callout } from "../../../src/design/components/Callout";
import { Card } from "../../../src/design/components/Card";
import { Table } from "../../../src/design/components/Table";
import { renderToString } from "../../../src/design/render";

describe("renderToString", () => {
  it("renders a synchronous JSX tree to a plain string", () => {
    const html = renderToString(<p>hello</p>);
    expect(html).toBe("<p>hello</p>");
  });
});

describe("Button", () => {
  it("renders a <button> by default, submit type, secondary style", () => {
    const html = renderToString(<Button>Save</Button>);
    expect(html).toContain("<button");
    expect(html).toContain('type="submit"');
    expect(html).toContain('class="btn"');
    expect(html).toContain("Save");
  });

  it("renders an <a> styled as a button when href is given", () => {
    const html = renderToString(<Button href="/dashboard">Back</Button>);
    expect(html).toContain("<a");
    expect(html).toContain('href="/dashboard"');
    expect(html).not.toContain("<button");
  });

  it("applies btn-primary for the primary variant", () => {
    const html = renderToString(<Button variant="primary">Go</Button>);
    expect(html).toContain("btn btn-primary");
  });
});

describe("Badge", () => {
  it("renders the status-specific class and label", () => {
    const html = renderToString(<Badge status="good" label="connected" />);
    expect(html).toContain("badge badge-good");
    expect(html).toContain("connected");
  });
});

describe("Callout", () => {
  it("wraps children in a .callout div", () => {
    const html = renderToString(
      <Callout>
        <p>note</p>
      </Callout>
    );
    expect(html).toContain('class="callout"');
    expect(html).toContain("<p>note</p>");
  });
});

describe("Card", () => {
  it("renders a div.card with an optional title", () => {
    const html = renderToString(
      <Card title="A tool">
        <p>desc</p>
      </Card>
    );
    expect(html).toContain('class="card"');
    expect(html).toContain("<h3>A tool</h3>");
  });

  it("renders as a link when href is given", () => {
    const html = renderToString(<Card href="/tools/x">x</Card>);
    expect(html).toContain("<a");
    expect(html).toContain('href="/tools/x"');
  });
});

describe("Table", () => {
  it("renders headers and passed-in row children, wrapped for horizontal scroll", () => {
    const html = renderToString(
      <Table headers={["Name", "Domain"]}>
        <tr>
          <td>Example</td>
          <td>example.com</td>
        </tr>
      </Table>
    );
    expect(html).toContain('class="table-scroll"');
    expect(html).toContain("<th>Name</th>");
    expect(html).toContain("<th>Domain</th>");
    expect(html).toContain("<td>Example</td>");
  });
});
