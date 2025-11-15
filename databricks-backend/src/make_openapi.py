"""Generate OpenAPI spec without starting server."""

import json
import sys
from pathlib import Path

import click


def enhance_spec_for_ui_teams(spec):
    """Add UI-friendly enhancements to OpenAPI spec."""
    # Add server configurations
    if "servers" not in spec:
        spec["servers"] = []

    # Ensure we have development and production servers
    servers = [
        {"url": "http://localhost:8000", "description": "Development server"},
        {"url": "https://api-staging.nexa.com", "description": "Staging server"},
        {"url": "https://api.nexa.com", "description": "Production server"},
    ]

    # Add servers if not already present
    existing_urls = {s.get("url") for s in spec.get("servers", [])}
    for server in servers:
        if server["url"] not in existing_urls:
            spec["servers"].append(server)

    # Enhance info section
    if "info" not in spec:
        spec["info"] = {}

    spec["info"].update(
        {
            "title": spec["info"].get("title", "Nexa Databricks API"),
            "description": spec["info"].get(
                "description",
                "API for managing Databricks deployments, pipelines, and Unity Catalog operations",
            ),
            "contact": {"name": "Nexa Platform Team", "email": "engineering@nexa.ai"},
        }
    )

    return spec


@click.command()
@click.option("--output", help="Output file path", default="openapi.json")
@click.option(
    "--format",
    type=click.Choice(["json", "yaml"]),
    default="json",
    help="Output format",
)
@click.option("--enhance", is_flag=True, help="Add UI-friendly enhancements")
def main(output: str, format: str, enhance: bool) -> None:
    """Generate the OpenAPI specification from the FastAPI application.

    This command-line utility imports the main FastAPI application, generates its
    OpenAPI schema, and saves it to a specified file. This is useful for
    generating API documentation or for use with other OpenAPI-compatible tools
    without needing to run the web server.

    Args:
        output (str): The file path where the OpenAPI spec will be saved.
        format (str): Output format - 'json' or 'yaml'
        enhance (bool): Add UI-friendly enhancements like server configs
    """
    try:
        # Add project root to Python path for proper module imports
        project_root = Path(__file__).parent.parent
        if str(project_root) not in sys.path:
            sys.path.insert(0, str(project_root))

        # Import the FastAPI app using absolute import
        from src.app import app

        # Generate OpenAPI spec
        openapi_spec = app.openapi()

        # Apply enhancements if requested
        if enhance:
            openapi_spec = enhance_spec_for_ui_teams(openapi_spec)

        # Write to file
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if format == "yaml":
            try:
                import yaml

                with open(output_path, "w") as f:
                    yaml.dump(openapi_spec, f, default_flow_style=False, indent=2)
                print(f"OpenAPI spec (YAML) written to {output}")
            except ImportError:
                print("PyYAML not installed, falling back to JSON format")
                format = "json"

        if format == "json":
            with open(output_path, "w") as f:
                json.dump(openapi_spec, f, indent=2)
            print(f"OpenAPI spec (JSON) written to {output}")

        # Print summary
        paths_count = len(openapi_spec.get("paths", {}))
        endpoints_count = sum(
            len([m for m in methods.keys() if m != "parameters"])
            for methods in openapi_spec.get("paths", {}).values()
        )

        print("\n📊 API Summary:")
        print(f"   Version: {openapi_spec.get('info', {}).get('version', 'Unknown')}")
        print(f"   Paths: {paths_count}")
        print(f"   Endpoints: {endpoints_count}")

        if enhance:
            print(f"   Servers: {len(openapi_spec.get('servers', []))}")
            print("\n🚀 For UI teams:")
            print(
                f"   npx @openapitools/openapi-generator-cli generate -i {output} -g typescript-axios -o ./src/api-client"
            )

    except Exception as e:
        print(f"Error generating OpenAPI spec: {e}")
        raise


if __name__ == "__main__":
    main()
