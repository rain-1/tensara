import type { NextApiRequest, NextApiResponse } from "next";
import * as archiver from "archiver";
import { db } from "~/server/db";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { slug } = req.query;

  if (typeof slug !== "string") {
    return res.status(400).json({ error: "Invalid problem slug" });
  }

  try {
    // Fetch problem from database
    const problem = await db.problem.findUnique({
      where: { slug },
      select: {
        title: true,
        slug: true,
        description: true,
        definition: true,
        difficulty: true,
        parameters: true,
        tags: true,
      },
    });

    if (!problem) {
      return res.status(404).json({ error: "Problem not found" });
    }

    // Set response headers for zip download
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${problem.slug}.zip"`,
    );

    // Create archiver instance
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add README.md with problem description
    const readme = generateReadme(problem);
    archive.append(readme, { name: "README.md" });

    // Add problem.py (the problem definition)
    if (problem.definition) {
      archive.append(problem.definition, { name: "problem.py" });
    }

    // Add solution templates for different languages
    const cudaTemplate = generateCUDATemplate(problem);
    archive.append(cudaTemplate, { name: "solution_template.cu" });

    const cppTemplate = generateCPPTemplate(problem);
    archive.append(cppTemplate, { name: "solution_template.cpp" });

    const pythonTemplate = generatePythonTemplate(problem);
    archive.append(pythonTemplate, { name: "solution_template.py" });

    // Add Makefile
    const makefile = generateMakefile(problem);
    archive.append(makefile, { name: "Makefile" });

    // Add test runner script
    const testRunner = generateTestRunner(problem);
    archive.append(testRunner, { name: "test_runner.py" });

    // Add requirements.txt for Python dependencies
    const requirements = generateRequirements();
    archive.append(requirements, { name: "requirements.txt" });

    // Add .gitignore
    const gitignore = generateGitignore();
    archive.append(gitignore, { name: ".gitignore" });

    // Finalize the archive
    await archive.finalize();
  } catch (error) {
    console.error("Error generating problem package:", error);
    res.status(500).json({ error: "Failed to generate problem package" });
  }
}

function generateReadme(problem: {
  title: string;
  slug: string;
  description: string | null;
  difficulty: string;
  tags: string[];
}): string {
  return `# ${problem.title}

**Difficulty:** ${problem.difficulty}
**Tags:** ${problem.tags.join(", ")}

## Problem Description

${problem.description || "No description available."}

## Getting Started

This package contains everything you need to work on this problem locally.

### Files Included

- \`README.md\` - This file
- \`problem.py\` - Problem definition with test case generator and reference solution
- \`solution_template.cu\` - CUDA solution template
- \`solution_template.cpp\` - C++ solution template
- \`solution_template.py\` - Python solution template
- \`Makefile\` - Build and test automation
- \`test_runner.py\` - Local test runner script
- \`requirements.txt\` - Python dependencies

### Setup

1. Install Python dependencies:
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`

2. For CUDA development, ensure you have:
   - NVIDIA CUDA Toolkit installed
   - PyTorch with CUDA support
   - \`nvcc\` compiler available

### Building and Testing

#### CUDA Solution
\`\`\`bash
# Build CUDA solution
make build-cuda

# Run tests
make test-cuda

# Run with specific dtype
make test-cuda DTYPE=float16
\`\`\`

#### C++ Solution
\`\`\`bash
# Build C++ solution
make build-cpp

# Run tests
make test-cpp
\`\`\`

#### Python Solution
\`\`\`bash
# Run tests
make test-python
\`\`\`

### Test Output

The test runner will:
- Generate test cases using the problem definition
- Run your solution against each test case
- Compare results with the reference solution
- Display pass/fail status for each test
- Show detailed error information if tests fail

### Profiling

To profile your CUDA solution with NVIDIA Nsight Compute:
\`\`\`bash
ncu --set full -o profile python test_runner.py cuda
\`\`\`

### Submitting

Once you're satisfied with your solution:
1. Go to https://tensara.ai/problems/${problem.slug}
2. Copy your code from the solution file
3. Paste it into the online editor
4. Submit and view results

## Notes

- The test cases are generated dynamically by \`problem.py\`
- Your solution must match the reference solution's output exactly
- Pay attention to numerical precision when using different dtypes
- CUDA solutions should leverage GPU parallelism for best performance
`;
}

function generateCUDATemplate(problem: {
  slug: string;
  parameters: unknown;
}): string {
  const params = Array.isArray(problem.parameters)
    ? problem.parameters
    : [];
  const paramList = params.map((p: { name: string }) => p.name).join(", ");

  return `#include <cuda_runtime.h>
#include <torch/extension.h>

// CUDA kernel implementation
// TODO: Implement your CUDA kernel here
__global__ void ${problem.slug}_kernel(
    // Add your kernel parameters here
) {
    // Your kernel implementation
}

// C++ wrapper function
torch::Tensor ${problem.slug}_cuda(${paramList.length > 0 ? "/* Add parameters: " + paramList + " */" : ""}) {
    // TODO: Implement your CUDA solution here
    // 1. Allocate output tensor
    // 2. Launch kernel
    // 3. Return result

    throw std::runtime_error("Not implemented");
}

PYBIND11_MODULE(TORCH_EXTENSION_NAME, m) {
    m.def("${problem.slug}", &${problem.slug}_cuda, "CUDA implementation");
}
`;
}

function generateCPPTemplate(problem: {
  slug: string;
  parameters: unknown;
}): string {
  const params = Array.isArray(problem.parameters)
    ? problem.parameters
    : [];
  const paramList = params.map((p: { name: string }) => p.name).join(", ");

  return `#include <torch/extension.h>

// C++ implementation
torch::Tensor ${problem.slug}_cpp(${paramList.length > 0 ? "/* Add parameters: " + paramList + " */" : ""}) {
    // TODO: Implement your C++ solution here

    throw std::runtime_error("Not implemented");
}

PYBIND11_MODULE(TORCH_EXTENSION_NAME, m) {
    m.def("${problem.slug}", &${problem.slug}_cpp, "C++ implementation");
}
`;
}

function generatePythonTemplate(problem: {
  slug: string;
  parameters: unknown;
}): string {
  const params = Array.isArray(problem.parameters)
    ? problem.parameters
    : [];
  const paramList = params.map((p: { name: string }) => p.name).join(", ");

  return `import torch

def ${problem.slug}(${paramList}):
    """
    Python implementation of ${problem.slug}

    Args:
        ${params.map((p: { name: string; type?: string }) => `${p.name}: ${p.type || "torch.Tensor"}`).join("\n        ")}

    Returns:
        torch.Tensor: Result tensor
    """
    # TODO: Implement your Python solution here
    raise NotImplementedError("Solution not implemented")
`;
}

function generateMakefile(problem: { slug: string }): string {
  return `# Makefile for ${problem.slug}

# Default dtype for testing
DTYPE ?= float32

# Python interpreter
PYTHON ?= python3

# CUDA architecture (adjust for your GPU)
CUDA_ARCH ?= sm_75

.PHONY: help build-cuda build-cpp test-cuda test-cpp test-python clean

help:
\t@echo "Available targets:"
\t@echo "  build-cuda      - Build CUDA solution"
\t@echo "  build-cpp       - Build C++ solution"
\t@echo "  test-cuda       - Test CUDA solution"
\t@echo "  test-cpp        - Test C++ solution"
\t@echo "  test-python     - Test Python solution"
\t@echo "  clean           - Remove build artifacts"
\t@echo ""
\t@echo "Options:"
\t@echo "  DTYPE=<dtype>   - Set data type (float32, float16, bfloat16)"

build-cuda: solution_template.cu
\t@echo "Building CUDA solution..."
\t@mkdir -p build
\t\$(PYTHON) -c "import torch.utils.cpp_extension as ext; ext.load('solution', ['solution_template.cu'], extra_cuda_cflags=['-arch=\$(CUDA_ARCH)'], build_directory='build', verbose=True)"
\t@echo "Build complete!"

build-cpp: solution_template.cpp
\t@echo "Building C++ solution..."
\t@mkdir -p build
\t\$(PYTHON) -c "import torch.utils.cpp_extension as ext; ext.load('solution', ['solution_template.cpp'], build_directory='build', verbose=True)"
\t@echo "Build complete!"

test-cuda: build-cuda
\t@echo "Running CUDA tests with dtype=\$(DTYPE)..."
\t\$(PYTHON) test_runner.py cuda --dtype \$(DTYPE)

test-cpp: build-cpp
\t@echo "Running C++ tests with dtype=\$(DTYPE)..."
\t\$(PYTHON) test_runner.py cpp --dtype \$(DTYPE)

test-python:
\t@echo "Running Python tests with dtype=\$(DTYPE)..."
\t\$(PYTHON) test_runner.py python --dtype \$(DTYPE)

profile-cuda: build-cuda
\t@echo "Profiling CUDA solution..."
\tncu --set full -o profile_\$(DTYPE) \$(PYTHON) test_runner.py cuda --dtype \$(DTYPE)

clean:
\t@echo "Cleaning build artifacts..."
\trm -rf build __pycache__ *.so *.o
\t@echo "Clean complete!"
`;
}

function generateTestRunner(problem: { slug: string }): string {
  return `#!/usr/bin/env python3
"""
Local test runner for ${problem.slug}

This script loads the problem definition, generates test cases,
and runs your solution against them.
"""

import sys
import argparse
import importlib.util
from pathlib import Path
import torch

# ANSI color codes for terminal output
GREEN = "\\033[92m"
RED = "\\033[91m"
YELLOW = "\\033[93m"
BLUE = "\\033[94m"
RESET = "\\033[0m"


def load_problem_module():
    """Load the problem module from problem.py"""
    problem_path = Path(__file__).parent / "problem.py"
    spec = importlib.util.spec_from_file_location("problem_module", problem_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    # Find the Problem subclass
    for name in dir(module):
        obj = getattr(module, name)
        if (isinstance(obj, type) and
            hasattr(obj, 'generate_test_cases') and
            name != 'Problem'):
            return obj()

    raise RuntimeError("Could not find Problem subclass in problem.py")


def load_solution(language: str, build_dir: Path):
    """Load the compiled solution based on language"""
    if language == "python":
        # Import Python solution
        spec = importlib.util.spec_from_file_location(
            "solution",
            Path(__file__).parent / "solution_template.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        # Find the solution function
        problem = load_problem_module()
        func_name = problem.__class__.__name__
        if hasattr(module, func_name):
            return getattr(module, func_name)
        else:
            raise RuntimeError(f"Could not find function {func_name} in solution_template.py")

    else:
        # Load compiled C++/CUDA extension
        if not build_dir.exists():
            raise RuntimeError(
                f"Build directory not found. Run 'make build-{language}' first."
            )

        # Import the compiled module
        sys.path.insert(0, str(build_dir))
        import solution

        problem = load_problem_module()
        func_name = problem.__class__.__name__
        if hasattr(solution, func_name):
            return getattr(solution, func_name)
        else:
            raise RuntimeError(f"Could not find function {func_name} in compiled solution")


def run_tests(language: str, dtype_str: str):
    """Run all test cases"""
    print(f"{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Running tests for ${problem.slug}{RESET}")
    print(f"{BLUE}Language: {language.upper()}, Dtype: {dtype_str}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\\n")

    # Load problem
    problem = load_problem_module()

    # Parse dtype
    dtype_map = {
        "float32": torch.float32,
        "float16": torch.float16,
        "bfloat16": torch.bfloat16,
    }
    dtype = dtype_map.get(dtype_str, torch.float32)

    # Load solution
    build_dir = Path(__file__).parent / "build"
    solution_func = load_solution(language, build_dir)

    # Generate test cases
    print(f"{YELLOW}Generating test cases...{RESET}")
    test_cases = problem.generate_test_cases(dtype)
    print(f"{YELLOW}Generated {len(test_cases)} test cases{RESET}\\n")

    # Run tests
    passed = 0
    failed = 0

    for i, test_case in enumerate(test_cases, 1):
        test_name = test_case.get("name", f"Test {i}")
        print(f"[{i}/{len(test_cases)}] {test_name}... ", end="", flush=True)

        try:
            # Create inputs
            input_tensors = test_case["create_inputs"]()

            # Get expected output from reference solution
            expected = problem.reference_solution(*input_tensors).cpu()

            # Run solution
            if language == "python":
                actual = solution_func(*input_tensors).cpu()
            else:
                # For CUDA/C++, ensure inputs are on correct device
                cuda_inputs = [t.cuda() if isinstance(t, torch.Tensor) else t
                              for t in input_tensors]
                actual = solution_func(*cuda_inputs).cpu()

            # Verify result
            is_correct, debug_info = problem.verify_result(expected, actual, dtype)

            if is_correct:
                print(f"{GREEN}PASS{RESET}")
                passed += 1
            else:
                print(f"{RED}FAIL{RESET}")
                failed += 1
                print(f"  {RED}Error: {debug_info.get('error', 'Unknown error')}{RESET}")
                if 'max_diff' in debug_info:
                    print(f"  Max difference: {debug_info['max_diff']}")
                if 'tolerance' in debug_info:
                    print(f"  Tolerance: {debug_info['tolerance']}")

        except Exception as e:
            print(f"{RED}ERROR{RESET}")
            failed += 1
            print(f"  {RED}Exception: {str(e)}{RESET}")

    # Print summary
    print(f"\\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}Test Summary{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    print(f"{GREEN}Passed: {passed}/{len(test_cases)}{RESET}")
    if failed > 0:
        print(f"{RED}Failed: {failed}/{len(test_cases)}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\\n")

    return failed == 0


def main():
    parser = argparse.ArgumentParser(description="Run local tests for problem solution")
    parser.add_argument(
        "language",
        choices=["cuda", "cpp", "python"],
        help="Solution language to test"
    )
    parser.add_argument(
        "--dtype",
        default="float32",
        choices=["float32", "float16", "bfloat16"],
        help="Data type for tests (default: float32)"
    )

    args = parser.parse_args()

    try:
        success = run_tests(args.language, args.dtype)
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"{RED}Error: {str(e)}{RESET}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
`;
}

function generateRequirements(): string {
  return `# Python dependencies for local development
torch>=2.0.0
numpy>=1.24.0
`;
}

function generateGitignore(): string {
  return `# Build artifacts
build/
*.so
*.o
*.pyc
__pycache__/

# IDE
.vscode/
.idea/
*.swp
*.swo

# Profiling
*.ncu-rep
profile_*

# System
.DS_Store
`;
}
