#!/usr/bin/env python3
"""
CI/CD Pipeline Audit for Lebensordner.

Audits the GitHub Actions pipeline (.github/workflows/ci.yml) for optimization
gaps and security issues before every commit. Companion to pre-deploy-qa.py.

Checks covered (21 total across 6 sections):
  - Actions pinned to SHA digest (not floating @v4 tags)
  - Stable runner versions (ubuntu-24.04 vs ubuntu-latest)
  - Top-level permissions block
  - Job timeout limits to prevent 6-hour hangs
  - Lint / type-check gates in CI
  - Deploy concurrency safety (cancel-in-progress: false)
  - Workflow-level concurrency safety for deploy runs
  - paths-ignore configured
  - pre-deploy-qa.py invoked in CI
  - npm / Next.js / Playwright / Docker caching
  - Node version consistency CI ↔ Dockerfiles
  - Docker base image digest pinning
  - Deploy environment declaration
  - Smoke-check job after deploy
  - SSH action timeout
  - Dockerfile.worker non-root user
  - Worker runtime avoids transient npx downloads

Usage:
    python scripts/ops/cicd-audit.py              # full audit
    python scripts/ops/cicd-audit.py --strict     # treat WARNs as failures
    python scripts/ops/cicd-audit.py --fix-hints  # show YAML fix snippets
"""

import argparse
import re
import sys
from pathlib import Path
from typing import NamedTuple

# ANSI colours
RED  = "\033[91m"
GRN  = "\033[92m"
YLW  = "\033[93m"
BLU  = "\033[94m"
CYN  = "\033[96m"
DIM  = "\033[2m"
BOLD = "\033[1m"
RST  = "\033[0m"


class Result(NamedTuple):
    status: str   # PASS | WARN | FAIL
    check:  str
    detail: str = ""


results: list[Result] = []
_fix_hints: bool = False


def record(status: str, check: str, detail: str = "") -> None:
    results.append(Result(status, check, detail))
    icons = {"PASS": f"{GRN}PASS{RST}", "WARN": f"{YLW}WARN{RST}", "FAIL": f"{RED}FAIL{RST}"}
    print(f"  {icons[status]}  {check}")
    if detail:
        for line in detail.strip().splitlines():
            print(f"         {DIM}{line}{RST}")


def hint(text: str) -> None:
    """Print fix-hint YAML/Dockerfile block if --fix-hints is enabled."""
    if not _fix_hints:
        return
    print(f"         {CYN}Fix hint:{RST}")
    for line in text.rstrip().splitlines():
        print(f"         {CYN}{line}{RST}")
    print()


def section(title: str) -> None:
    pad = "-" * max(0, 60 - len(title))
    print(f"\n{BOLD}{BLU}-- {title} {pad}{RST}")


ROOT = Path(__file__).resolve().parents[2]


def read(rel: str) -> str:
    p = ROOT / rel
    return p.read_text(encoding="utf-8", errors="replace") if p.exists() else ""


def get_jobs_section(ci: str) -> str:
    """Return the text from 'jobs:' to end of file."""
    m = re.search(r'^jobs:\n', ci, re.MULTILINE)
    return ci[m.end():] if m else ""


def get_job_names(ci: str) -> list[str]:
    """Return the list of job names from the jobs: section (2-space indent, no deeper)."""
    jobs = get_jobs_section(ci)
    # Lines that start with exactly 2 spaces then a lowercase letter are job names.
    return re.findall(r'(?m)^  ([a-z][\w-]+):\n', jobs)


def get_job_block(ci: str, job_name: str) -> str:
    """Extract the indented YAML block for a CI job (2-space indent convention)."""
    # Jobs are at 2-space indent; content is 4+ spaces.
    # Stop collecting when we hit the next 2-space-indented job name.
    pattern = rf'(\n  {re.escape(job_name)}:\n(?:(?!\n  [a-z][\w-]+:\n)[\s\S])*)'
    m = re.search(pattern, ci)
    return m.group(1) if m else ""


def parse_action_uses(ci: str) -> list[str]:
    """Return all 'uses: <action>' values from the workflow."""
    return re.findall(r'uses:\s+([\w./-]+@[^\s]+)', ci)


def get_deploy_workflow() -> tuple[str, str]:
    """
    Return (path, content) for the workflow that defines the deploy job.
    Supports split CI/deploy workflows.
    """
    candidates = [
        ".github/workflows/ci.yml",
        ".github/workflows/deploy.yml",
    ]
    for path in candidates:
        content = read(path)
        if not content:
            continue
        if get_job_block(content, "deploy"):
            return path, content
    return "", ""


# ==============================================================================
# SECTION 1 — Security
# ==============================================================================

def check_actions_pinned_to_sha() -> None:
    """All 'uses:' directives should reference an immutable SHA digest, not a tag."""
    ci = read(".github/workflows/ci.yml")
    if not ci:
        record("WARN", "ci.yml not found -- skipping action pin check")
        return
    unpinned_rx = re.compile(r'uses:\s+([\w.-]+/[\w.-]+@(?![\da-f]{40}\b)[^\s]+)')
    unpinned = unpinned_rx.findall(ci)
    if unpinned:
        record(
            "WARN",
            f"{len(unpinned)} action(s) not pinned to a full SHA digest",
            "\n".join(unpinned),
        )
        hint("""\
# Pin each action to an immutable commit SHA, for example:
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683        # v4.2.2
uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af      # v4.1.0
uses: actions/cache@6849a6489940f00c2f30c0fb92c6274307ccb58a            # v4.1.2
uses: docker/login-action@9780b0c442fbb1117ed29e0efdff1e18412f7567      # v3.3.0
uses: docker/setup-buildx-action@6524bf65af31da8d45b59e8c27de4bd072b392f # v3.8.0
uses: docker/build-push-action@ca877d9245402d1537745e0e356eab47c3520991  # v6.14.0
uses: appleboy/ssh-action@7eaf76671a0d7eec5d98ee897acda4f968735a17   # v1.0.3
# Use 'pinact' (https://github.com/suzuki-shunsuke/pinact) to automate pinning.""")
    else:
        record("PASS", "All GitHub Actions are pinned to full SHA digests")


def check_runner_version() -> None:
    """ubuntu-latest is a floating label; a pinned version ensures a fixed environment."""
    ci = read(".github/workflows/ci.yml")
    if not ci:
        record("WARN", "ci.yml not found -- skipping runner version check")
        return
    hits = re.findall(r'runs-on:\s+(ubuntu-latest)', ci)
    if hits:
        record(
            "WARN",
            f"{len(hits)} job(s) use 'ubuntu-latest' (floating runner label)",
            "ubuntu-latest changes when GitHub upgrades the default runner,\n"
            "potentially breaking builds without warning.",
        )
        hint("""\
# Replace 'ubuntu-latest' with a pinned version in each job:
    runs-on: ubuntu-24.04""")
    else:
        record("PASS", "All jobs use a pinned runner version (not ubuntu-latest)")


def check_top_level_permissions() -> None:
    """Top-level 'permissions:' block restricts the default GITHUB_TOKEN scope."""
    ci = read(".github/workflows/ci.yml")
    if not ci:
        record("WARN", "ci.yml not found -- skipping permissions check")
        return
    if re.search(r'^permissions:', ci, re.MULTILINE):
        record("PASS", "Top-level 'permissions:' block is present")
    else:
        record(
            "WARN",
            "No top-level 'permissions:' block found",
            "Without it, GitHub uses the repo default (read/write for all scopes).",
        )
        hint("""\
# Add at the workflow level (before 'jobs:'):
permissions:
  contents: read
  packages: write""")


def check_job_timeouts() -> None:
    """All jobs should have 'timeout-minutes:' to prevent 6-hour stuck runners."""
    ci = read(".github/workflows/ci.yml")
    if not ci:
        record("WARN", "ci.yml not found -- skipping timeout check")
        return
    job_names = get_job_names(ci)
    missing = []
    for job in job_names:
        block = get_job_block(ci, job)
        if block and "timeout-minutes:" not in block:
            missing.append(job)
    if missing:
        record(
            "WARN",
            f"{len(missing)} job(s) missing 'timeout-minutes:'",
            "\n".join(missing) +
            "\nHung jobs consume runner minutes for up to 6 hours by default.",
        )
        hint("""\
# Add 'timeout-minutes:' to each job, e.g.:
  unit-tests:
    runs-on: ubuntu-24.04
    timeout-minutes: 15

  build-nextjs:
    timeout-minutes: 30

  deploy:
    timeout-minutes: 20

  smoke-check:
    timeout-minutes: 10""")
    else:
        record("PASS", "All jobs have 'timeout-minutes:' set")


# ==============================================================================
# SECTION 2 — Pipeline Structure
# ==============================================================================

def check_lint_job_in_ci() -> None:
    """A lint gate catches ESLint regressions before merge; currently only runs locally."""
    ci = read(".github/workflows/ci.yml")
    if not ci:
        record("WARN", "ci.yml not found -- skipping lint gate check")
        return
    has_lint = bool(re.search(r'next lint|eslint|npm run lint', ci))
    if has_lint:
        record("PASS", "CI workflow includes a lint gate")
    else:
        record(
            "WARN",
            "No 'lint' step found in CI (next lint / eslint)",
            "'next lint' currently only runs locally. ESLint regressions reach main undetected.",
        )
        hint("""\
# Add a lint job before unit-tests:
  lint:
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@<SHA>
      - uses: actions/setup-node@<SHA>
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint""")


def check_type_check_job_in_ci() -> None:
    """A type-check gate catches TypeScript errors before merge."""
    ci = read(".github/workflows/ci.yml")
    if not ci:
        record("WARN", "ci.yml not found -- skipping type-check gate check")
        return
    has_tsc = bool(re.search(r'tsc\s+--noEmit|npm run type-check', ci))
    if has_tsc:
        record("PASS", "CI workflow includes a type-check gate")
    else:
        record(
            "WARN",
            "No 'tsc --noEmit' or type-check step found in CI",
            "'tsc --noEmit' currently only runs locally. Type errors can reach main silently.",
        )
        hint("""\
# Add a type-check job (can run in parallel with lint):
  type-check:
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@<SHA>
      - uses: actions/setup-node@<SHA>
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run type-check""")


def check_deploy_concurrency() -> None:
    """
    Deploy job must have its own concurrency block with cancel-in-progress: false.
    The workflow-level group uses cancel-in-progress: true which can kill a mid-flight deploy.
    """
    workflow_path, workflow = get_deploy_workflow()
    if not workflow:
        record("WARN", "No workflow with a 'deploy' job found -- skipping deploy concurrency check")
        return
    deploy_block = get_job_block(workflow, "deploy")
    has_concurrency = "concurrency:" in deploy_block
    has_cancel_false = "cancel-in-progress: false" in deploy_block
    if has_concurrency and has_cancel_false:
        record("PASS", f"Deploy job has its own concurrency block with cancel-in-progress: false ({workflow_path})")
    else:
        record(
            "WARN",
            "Deploy job is in the workflow-level cancel group (cancel-in-progress: true)",
            "A new push can cancel a running deploy mid-flight, leaving the server half-updated.",
        )
        hint("""\
# Add a job-level concurrency block to the deploy job:
  deploy:
    needs: [build-nextjs, build-worker]
    concurrency:
      group: deploy-production
      cancel-in-progress: false  # never cancel a running deploy
    runs-on: ubuntu-24.04""")


def check_workflow_concurrency_safety() -> None:
    """
    Workflow-level cancel-in-progress: true can still kill a running deploy.
    Job-level deploy concurrency does not protect against run cancellation.
    """
    ci = read(".github/workflows/ci.yml")
    if not ci:
        record("WARN", "ci.yml not found -- skipping workflow concurrency safety check")
        return

    has_deploy = bool(re.search(r'(?m)^  deploy:\n', get_jobs_section(ci)))
    lines = ci.splitlines()

    has_workflow_concurrency = False
    workflow_cancel_true = False
    in_workflow_concurrency = False
    for line in lines:
        if re.match(r'^concurrency:\s*$', line):
            has_workflow_concurrency = True
            in_workflow_concurrency = True
            continue

        # Workflow-level block keys are indented by two spaces.
        if in_workflow_concurrency:
            if line.startswith("  "):
                if re.search(r'^\s*cancel-in-progress:\s*true\s*$', line):
                    workflow_cancel_true = True
            elif line.strip():
                # Exiting top-level concurrency block.
                in_workflow_concurrency = False

    if not has_deploy:
        record("PASS", "No deploy job found (workflow-level concurrency deploy risk not applicable)")
        return

    if has_workflow_concurrency and workflow_cancel_true:
        record(
            "WARN",
            "Workflow-level concurrency uses cancel-in-progress: true while deploy exists",
            "A newer run can cancel the entire in-flight deploy run.\n"
            "Use a separate deploy workflow or disable workflow-level cancellation.",
        )
        hint("""\
# Safer option: do not cancel whole runs when deploy jobs exist
concurrency:
  group: ci-cd-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false

# Alternative: split CI and deploy into separate workflows,
# keep cancel-in-progress: true only in CI workflow.""")
    else:
        record("PASS", "Workflow-level concurrency will not auto-cancel active deploy runs")


def check_paths_ignore() -> None:
    """paths-ignore prevents CI runs for documentation-only commits."""
    ci = read(".github/workflows/ci.yml")
    if not ci:
        record("WARN", "ci.yml not found -- skipping paths-ignore check")
        return
    if "paths-ignore:" in ci:
        record("PASS", "'paths-ignore:' is configured on push/PR triggers")
    else:
        record(
            "WARN",
            "No 'paths-ignore:' configured on push/PR triggers",
            "Every push triggers full CI even for README/doc-only changes.",
        )
        hint("""\
# Add to push and pull_request triggers:
on:
  push:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '*.md'
      - '.claude/**'
  pull_request:
    paths-ignore:
      - 'docs/**'
      - '*.md'
      - '.claude/**'""")


def check_predeploy_qa_in_ci() -> None:
    """pre-deploy-qa.py should run in CI to catch app-level bugs automatically."""
    ci = read(".github/workflows/ci.yml")
    if not ci:
        record("WARN", "ci.yml not found -- skipping pre-deploy-qa check")
        return
    if "pre-deploy-qa" in ci or "npm run qa" in ci:
        record("PASS", "pre-deploy-qa.py is invoked in CI")
    else:
        record(
            "WARN",
            "pre-deploy-qa.py is not invoked in CI (manual-only)",
            "The 24-check app audit only runs locally; the automated pipeline skips it.",
        )
        hint("""\
# Add a pre-deploy QA step to the deploy job (after git pull, before docker pull):
      - name: Run pre-deploy QA
        run: python scripts/ops/pre-deploy-qa.py --strict""")


# ==============================================================================
# SECTION 3 — Caching
# ==============================================================================

def check_npm_cache_on_setup_node() -> None:
    """All setup-node steps should use 'cache: npm' to avoid re-downloading deps."""
    ci = read(".github/workflows/ci.yml")
    if not ci:
        record("WARN", "ci.yml not found -- skipping npm cache check")
        return
    lines = ci.splitlines()
    missing: list[str] = []
    step_num = 0
    for i, line in enumerate(lines):
        if re.search(r'uses:\s+actions/setup-node', line):
            step_num += 1
            # Look ahead up to 8 lines (covers the 'with:' block)
            snippet = "\n".join(lines[i : min(i + 8, len(lines))])
            if "cache:" not in snippet:
                missing.append(f"setup-node step {step_num}")
    if missing:
        record(
            "WARN",
            f"{len(missing)} setup-node step(s) missing 'cache: npm'",
            "\n".join(missing),
        )
        hint("""\
# Add cache to every setup-node step:
      - uses: actions/setup-node@<SHA>
        with:
          node-version: '22'
          cache: 'npm'""")
    else:
        record("PASS", "All setup-node steps use 'cache: npm'")


def check_nextjs_cache() -> None:
    """Caching .next/cache significantly speeds up Next.js builds."""
    ci = read(".github/workflows/ci.yml")
    if not ci:
        record("WARN", "ci.yml not found -- skipping Next.js cache check")
        return
    if ".next/cache" in ci:
        record("PASS", ".next/cache is configured in CI")
    else:
        record(
            "WARN",
            "No .next/cache caching found in CI",
            "Caching .next/cache can cut Next.js build times by 30–60%.",
        )
        hint("""\
# Add a cache step before the Next.js build step:
      - name: Cache Next.js build
        uses: actions/cache@<SHA>
        with:
          path: .next/cache
          key: nextjs-${{ runner.os }}-${{ hashFiles('package-lock.json', 'next.config.js') }}
          restore-keys: nextjs-${{ runner.os }}-""")


def check_playwright_cache() -> None:
    """Caching Playwright browsers avoids ~300 MB download on every e2e run."""
    ci = read(".github/workflows/ci.yml")
    if not ci:
        record("WARN", "ci.yml not found -- skipping Playwright cache check")
        return
    if "ms-playwright" in ci:
        record("PASS", "Playwright browser cache is configured")
    elif re.search(r'playwright.*cache|cache.*playwright', ci, re.IGNORECASE):
        record("PASS", "Playwright browser cache appears to be configured")
    else:
        record(
            "WARN",
            "No Playwright browser cache found in CI",
            "Playwright browsers are ~300 MB; caching saves minutes on every e2e run.",
        )
        hint("""\
# Add a cache step before playwright install:
      - name: Cache Playwright browsers
        id: playwright-cache
        uses: actions/cache@<SHA>
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
      - run: npx playwright install --with-deps chromium
        if: steps.playwright-cache.outputs.cache-hit != 'true'""")


def check_docker_gha_cache() -> None:
    """Docker build jobs should use GHA cache (type=gha) for layer caching."""
    ci = read(".github/workflows/ci.yml")
    deploy = read(".github/workflows/deploy.yml")
    combined = f"{ci}\n{deploy}"
    if not combined.strip():
        record("WARN", "No workflow files found -- skipping Docker GHA cache check")
        return
    has_nextjs_cache = bool(re.search(r'scope=nextjs', combined))
    has_worker_cache = bool(re.search(r'scope=worker', combined))
    if has_nextjs_cache and has_worker_cache:
        record("PASS", "Docker GHA cache configured on both build jobs")
    else:
        missing = []
        if not has_nextjs_cache:
            missing.append("build-nextjs")
        if not has_worker_cache:
            missing.append("build-worker")
        record("WARN", f"Docker GHA cache missing on: {', '.join(missing)}")
        hint("""\
# Add cache-from / cache-to to docker/build-push-action:
          cache-from: |
            type=gha,scope=nextjs
          cache-to: type=gha,mode=max,scope=nextjs""")


# ==============================================================================
# SECTION 4 — Node / Docker Consistency
# ==============================================================================

def check_node_version_consistency() -> None:
    """Node version in CI setup-node should match the Dockerfile base image version."""
    ci = read(".github/workflows/ci.yml")
    dockerfile = read("Dockerfile")
    dockerfile_worker = read("deploy/Dockerfile.worker")

    ci_versions = set(re.findall(r"node-version:\s+'?(\d+)'?", ci))
    df_versions = set(re.findall(r'FROM\s+node:(\d+)', dockerfile))
    dfw_versions = set(re.findall(r'FROM\s+node:(\d+)', dockerfile_worker))
    all_docker_versions = df_versions | dfw_versions

    if not ci_versions:
        record("WARN", "Could not detect Node version from ci.yml setup-node steps")
        return
    if not all_docker_versions:
        record("WARN", "Could not detect Node version from Dockerfiles")
        return

    if ci_versions == all_docker_versions:
        v = next(iter(ci_versions))
        record("PASS", f"Node version is consistent: {v} in CI and Dockerfiles")
    else:
        record(
            "WARN",
            f"Node version mismatch: CI uses {ci_versions}, Dockerfiles use {all_docker_versions}",
            "A mismatch can cause native-addon or Node API differences between\n"
            "the CI test environment and the production Docker image.",
        )
        hint("""\
# Align setup-node version with the Dockerfile base image (node:22-alpine):
      - uses: actions/setup-node@<SHA>
        with:
          node-version: '22'
          cache: 'npm'""")


def check_docker_base_image_pinned() -> None:
    """Dockerfile FROM lines should use @sha256: digest pins, not floating tags."""
    dockerfiles = [
        ("Dockerfile", read("Dockerfile")),
        ("deploy/Dockerfile.worker", read("deploy/Dockerfile.worker")),
    ]
    unpinned: list[str] = []
    for name, content in dockerfiles:
        if not content:
            continue
        from_lines = re.findall(r'^FROM\s+(.+)', content, re.MULTILINE)
        for image_ref in from_lines:
            image_name = image_ref.strip().split()[0]
            # Only flag external images (node:, nginx:, etc.), not internal stage refs
            if (":" in image_name or "/" in image_name) and "@sha256:" not in image_ref:
                unpinned.append(f"{name}: FROM {image_ref.strip()}")
    if unpinned:
        record(
            "WARN",
            f"{len(unpinned)} Dockerfile FROM line(s) use floating image tags",
            "\n".join(unpinned) +
            "\nFloating tags can silently pull breaking changes or new vulnerabilities.",
        )
        hint("""\
# Pin to a digest for reproducible builds:
FROM node:22-alpine@sha256:<digest>
# Get the digest:
#   docker pull node:22-alpine
#   docker inspect node:22-alpine --format '{{index .RepoDigests 0}}'""")
    else:
        record("PASS", "All Dockerfile FROM lines are pinned to digest (@sha256:)")


# ==============================================================================
# SECTION 5 — Deploy Safety
# ==============================================================================

def check_deploy_environment() -> None:
    """Deploy job should reference a GitHub Environment for protection rules."""
    workflow_path, workflow = get_deploy_workflow()
    if not workflow:
        record("WARN", "No workflow with a 'deploy' job found -- skipping deploy environment check")
        return
    deploy_block = get_job_block(workflow, "deploy")
    if deploy_block and "environment:" in deploy_block:
        record("PASS", f"Deploy job uses 'environment:' (GitHub Environment protection) ({workflow_path})")
    else:
        record(
            "WARN",
            "Deploy job missing 'environment:' declaration",
            "Without it, no required reviewers or wait timers can protect the deploy.",
        )
        hint("""\
  deploy:
    needs: [build-nextjs, build-worker]
    environment: Production""")


def check_smoke_check_job() -> None:
    """A smoke-check job after deploy catches broken deployments automatically."""
    workflow_path, workflow = get_deploy_workflow()
    if not workflow:
        record("WARN", "No workflow with a 'deploy' job found -- skipping smoke-check check")
        return
    has_smoke = bool(re.search(r'smoke.?check', workflow, re.IGNORECASE))
    has_needs_deploy = bool(re.search(r'needs:\s*deploy|needs:\s*\[.*deploy', workflow))
    if has_smoke and has_needs_deploy:
        record("PASS", f"smoke-check job exists and runs after deploy ({workflow_path})")
    elif has_smoke:
        record("WARN", "smoke-check job exists but may not depend on deploy")
        hint("""\
  smoke-check:
    needs: deploy
    if: always() && needs.deploy.result != 'skipped'""")
    else:
        record(
            "WARN",
            "No smoke-check job found after deploy",
            "A smoke-check validates the deployment is live before marking CI green.",
        )
        hint("""\
  smoke-check:
    needs: deploy
    if: always() && needs.deploy.result != 'skipped'
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    steps:
      - uses: appleboy/ssh-action@<SHA>
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          command_timeout: 5m
          script: bash scripts/ops/verify-deploy.sh""")


def check_ssh_action_timeout() -> None:
    """appleboy/ssh-action steps should set 'command_timeout' to prevent indefinite hangs."""
    workflow_path, workflow = get_deploy_workflow()
    if not workflow:
        record("WARN", "No workflow with a 'deploy' job found -- skipping SSH action timeout check")
        return
    # Find all ssh-action step blocks (from 'uses: appleboy/ssh-action' to next '- ')
    lines = workflow.splitlines()
    ssh_step_starts: list[int] = []
    for i, line in enumerate(lines):
        if re.search(r'uses:\s+appleboy/ssh-action', line):
            ssh_step_starts.append(i)
    if not ssh_step_starts:
        record("PASS", f"No appleboy/ssh-action steps found (nothing to check) ({workflow_path})")
        return
    missing: list[str] = []
    for step_num, start in enumerate(ssh_step_starts, 1):
        # Collect lines until the next step at the same or shallower indent
        snippet_lines = [lines[start]]
        for j in range(start + 1, min(start + 30, len(lines))):
            nxt = lines[j]
            # Next step begins with '      - ' (step separator)
            if re.match(r'\s+- (?:uses|run|name|id|if|with|env):', nxt) and j != start + 1:
                break
            snippet_lines.append(nxt)
        snippet = "\n".join(snippet_lines)
        if "command_timeout:" not in snippet and "timeout:" not in snippet:
            missing.append(f"ssh-action step {step_num} (line {start + 1})")
    if missing:
        record(
            "WARN",
            f"{len(missing)} appleboy/ssh-action step(s) missing 'command_timeout:'",
            "\n".join(missing) +
            "\nWithout a timeout, a hung SSH session blocks the job for up to 6 hours.",
        )
        hint("""\
# Add command_timeout to each appleboy/ssh-action step:
      - uses: appleboy/ssh-action@<SHA>
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          command_timeout: 15m
          script: |
            ...""")
    else:
        record("PASS", f"All appleboy/ssh-action steps have a timeout configured ({workflow_path})")


# ==============================================================================
# SECTION 6 — Worker Security
# ==============================================================================

def check_worker_dockerfile_nonroot() -> None:
    """Dockerfile.worker should run as a non-root user for container security."""
    content = read("deploy/Dockerfile.worker")
    if not content:
        record("WARN", "deploy/Dockerfile.worker not found")
        return
    user_lines = re.findall(r'(?mi)^\s*USER\s+([^\s#]+)', content)
    final_user = user_lines[-1].strip() if user_lines else ""
    if not final_user:
        record(
            "WARN",
            "Dockerfile.worker missing USER instruction (defaults to root)",
            "Creating users without USER still runs the container as root.",
        )
        hint("""\
# Add before CMD in deploy/Dockerfile.worker:
RUN addgroup --system --gid 1001 worker && \\
    adduser --system --uid 1001 --ingroup worker workeruser

USER workeruser""")
        return

    root_aliases = {"root", "0", "0:0"}
    if final_user in root_aliases or final_user.startswith("root:"):
        record(
            "WARN",
            f"Dockerfile.worker final USER is root-like: {final_user}",
            "Container should run as a dedicated non-root runtime user.",
        )
        hint("""\
# Ensure final runtime user is non-root:
USER workeruser""")
    else:
        record("PASS", f"Dockerfile.worker final USER is non-root: {final_user}")


def check_worker_runtime_npx_tsx() -> None:
    """
    Production worker images should avoid runtime 'npx tsx ...' bootstrap.
    It can trigger transient installs/network at container start.
    """
    worker_df = read("deploy/Dockerfile.worker")
    pkg = read("package.json")

    if not worker_df:
        record("WARN", "deploy/Dockerfile.worker not found -- skipping worker runtime command check")
        return

    uses_npx_tsx = bool(re.search(r'(?i)\bCMD\s*\[.*"npx"\s*,\s*"tsx"', worker_df))
    if not uses_npx_tsx:
        record("PASS", "Worker runtime command does not use 'npx tsx'")
        return

    # Lightweight JSON check (regex) to keep script dependency-free.
    has_tsx_dep = bool(re.search(r'"tsx"\s*:\s*"', pkg))
    if has_tsx_dep:
        record(
            "WARN",
            "Worker uses 'npx tsx' at runtime (tsx exists but startup is still indirect)",
            "Prefer a direct binary invocation or prebuilt JS entrypoint for deterministic startup.",
        )
        hint("""\
# Better runtime patterns:
# 1) Build TS -> JS in image and run node directly
# CMD ["node", "dist/worker-entrypoint.js"]
#
# 2) If tsx must stay, avoid npx indirection:
# CMD ["./node_modules/.bin/tsx", "src/worker-entrypoint.ts"]""")
    else:
        record(
            "WARN",
            "Worker uses 'npx tsx' at runtime but tsx is not a direct dependency",
            "This can fail offline or incur runtime package resolution/downloads.",
        )
        hint("""\
# Prefer deterministic runtime:
# 1) Add tsx to dependencies and call it directly (no npx), or
# 2) compile to JS during image build and run with node.
#
# Recommended:
# CMD ["node", "dist/worker-entrypoint.js"]""")


# ==============================================================================
# MAIN
# ==============================================================================

def main() -> int:
    global _fix_hints

    parser = argparse.ArgumentParser(description="CI/CD pipeline audit for Lebensordner")
    parser.add_argument(
        "--strict", action="store_true",
        help="Treat WARNs as failures -- blocks on any warning",
    )
    parser.add_argument(
        "--fix-hints", action="store_true",
        help="Print YAML/Dockerfile fix snippets after each WARN/FAIL",
    )
    args = parser.parse_args()
    _fix_hints = args.fix_hints

    print(f"\n{BOLD}{'=' * 68}{RST}")
    print(f"{BOLD}  Lebensordner CI/CD Pipeline Audit{RST}")
    print(f"{DIM}  Project root: {ROOT}{RST}")
    print(f"{BOLD}{'=' * 68}{RST}")

    section("Security")
    check_actions_pinned_to_sha()
    check_runner_version()
    check_top_level_permissions()
    check_job_timeouts()

    section("Pipeline Structure")
    check_lint_job_in_ci()
    check_type_check_job_in_ci()
    check_deploy_concurrency()
    check_workflow_concurrency_safety()
    check_paths_ignore()
    check_predeploy_qa_in_ci()

    section("Caching")
    check_npm_cache_on_setup_node()
    check_nextjs_cache()
    check_playwright_cache()
    check_docker_gha_cache()

    section("Node / Docker Consistency")
    check_node_version_consistency()
    check_docker_base_image_pinned()

    section("Deploy Safety")
    check_deploy_environment()
    check_smoke_check_job()
    check_ssh_action_timeout()

    section("Worker Security")
    check_worker_dockerfile_nonroot()
    check_worker_runtime_npx_tsx()

    n_pass = sum(1 for r in results if r.status == "PASS")
    n_warn = sum(1 for r in results if r.status == "WARN")
    n_fail = sum(1 for r in results if r.status == "FAIL")

    print(f"\n{BOLD}{'-' * 68}{RST}")
    print(f"{BOLD}  Results:  {GRN}{n_pass} PASS{RST}  {YLW}{n_warn} WARN{RST}  {RED}{n_fail} FAIL{RST}")
    print(f"{BOLD}{'-' * 68}{RST}\n")

    if n_fail > 0:
        print(f"{RED}{BOLD}  X  Pipeline BLOCKED -- fix all FAILs.{RST}\n")
        return 1
    if n_warn > 0 and args.strict:
        print(f"{YLW}{BOLD}  !  Pipeline BLOCKED (--strict) -- resolve WARNs before pushing.{RST}\n")
        return 1
    if n_warn > 0:
        print(f"{YLW}{BOLD}  !  Warnings present -- review before pushing.{RST}\n")
        return 0
    print(f"{GRN}{BOLD}  OK  All pipeline checks passed.{RST}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
