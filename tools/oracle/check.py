# SPDX-License-Identifier: AGPL-3.0-or-later
"""Independent check of Sumstair steps with sympy.

The TypeScript engine proposes steps. This script never imports that engine.
It rebuilds each expression and compares solution sets (and polynomial
identities) itself.
"""

from __future__ import annotations

import json
import sys

import sympy as sp


def branches(e: dict) -> list:
    k = e["k"]
    if k == "num":
        return [sp.Rational(int(e["n"]), int(e["d"]))]
    if k == "var":
        return [sp.Symbol(e["name"])]
    if k == "neg":
        return [-a for a in branches(e["a"])]
    if k == "sqrt":
        return [sp.sqrt(a) for a in branches(e["a"])]
    if k == "pm":
        out = []
        for a in branches(e["a"]):
            for b in branches(e["b"]):
                out.append(a + b)
                out.append(a - b)
        return out
    op = {
        "add": lambda a, b: a + b,
        "sub": lambda a, b: a - b,
        "mul": lambda a, b: a * b,
        "div": lambda a, b: a / b,
        "pow": lambda a, b: a**b,
    }[k]
    return [op(a, b) for a in branches(e["a"]) for b in branches(e["b"])]


def eq_set(lhs: dict, rhs: dict, sym: sp.Symbol) -> sp.Set:
    acc = sp.EmptySet
    for left in branches(lhs):
        for right in branches(rhs):
            acc = sp.Union(acc, sp.solveset(sp.Eq(left, right), sym, domain=sp.S.Reals))
    return acc


def ineq_set(lhs: dict, rhs: dict, rel: str, sym: sp.Symbol) -> sp.Set:
    left = branches(lhs)[0]
    right = branches(rhs)[0]
    expr = {"<": left < right, "<=": left <= right, ">": left > right, ">=": left >= right}[rel]
    return sp.solve_univariate_inequality(expr, sym, relational=False, domain=sp.S.Reals)


def state_set(s: dict, sym: sp.Symbol):
    kind = s["kind"]
    if kind == "none":
        return sp.EmptySet
    if kind == "all":
        return sp.S.Reals
    if kind == "inequality":
        return ineq_set(s["lhs"], s["rhs"], s["rel"], sym)
    if kind == "equation":
        return eq_set(s["lhs"], s["rhs"], sym)
    if kind == "or":
        acc = sp.EmptySet
        for q in s["eqs"]:
            acc = sp.Union(acc, eq_set(q["lhs"], q["rhs"], sym))
        return acc
    if kind == "expr":
        return None
    raise AssertionError(f"unexpected state {kind}")


def same_set(a, b) -> bool:
    if a == b:
        return True
    if isinstance(a, sp.FiniteSet) and isinstance(b, sp.FiniteSet):
        if len(a) != len(b):
            return False
        right = list(b)
        used = [False] * len(right)
        for x in a:
            found = False
            for i, y in enumerate(right):
                if used[i]:
                    continue
                if sp.simplify(x - y) == 0:
                    used[i] = True
                    found = True
                    break
            if not found:
                return False
        return True
    try:
        return bool(sp.SymmetricDifference(a, b) == sp.EmptySet)
    except TypeError:
        return False


def surd(v: dict):
    a = sp.Rational(int(v["an"]), int(v["ad"]))
    b = sp.Rational(int(v["bn"]), int(v["bd"]))
    return a + b * sp.sqrt(int(v["r"]))


def main() -> None:
    data = json.load(sys.stdin)
    x = sp.Symbol("x")
    failures = []
    for case in data["cases"]:
        cid = case["id"]
        problem = case["problem"]
        try:
            if problem["kind"] == "expr":
                original = branches(problem["expr"])[0]
                final = branches(case["answer"]["expr"])[0]
                if sp.expand(original - final) != 0:
                    failures.append(f"{cid}: factored form is not identical")
                for i, step in enumerate(case["steps"]):
                    if step["before"]["kind"] != "expr" or step["after"]["kind"] != "expr":
                        failures.append(f"{cid} step {i}: not an expression step")
                        continue
                    b0 = branches(step["before"]["expr"])[0]
                    a0 = branches(step["after"]["expr"])[0]
                    if sp.expand(b0 - a0) != 0:
                        failures.append(f"{cid} step {i} ({step['rule']}): not an identity")
                continue

            if problem["kind"] == "inequality":
                expected = ineq_set(problem["lhs"], problem["rhs"], problem["rel"], x)
            elif problem["kind"] == "equation":
                expected = eq_set(problem["lhs"], problem["rhs"], x)
            else:
                failures.append(f"{cid}: unknown problem")
                continue

            answer = case["answer"]
            if answer["kind"] == "interval":
                rel = answer["rel"]
                bound = sp.Rational(int(answer["n"]), int(answer["d"]))
                got = ineq_set(
                    {"k": "var", "name": "x"},
                    {"k": "num", "n": answer["n"], "d": answer["d"]},
                    rel,
                    x,
                )
                if not same_set(got, expected):
                    failures.append(f"{cid}: answer {rel} {bound} != {expected}")
            elif answer["kind"] == "roots":
                got = sp.FiniteSet(*(surd(v) for v in answer["values"]))
                if not same_set(got, expected):
                    failures.append(f"{cid}: roots {got} != {expected}")
            elif answer["kind"] == "none":
                if not same_set(sp.EmptySet, expected):
                    failures.append(f"{cid}: expected no solution, got {expected}")
            elif answer["kind"] == "all":
                if not same_set(sp.S.Reals, expected):
                    failures.append(f"{cid}: expected all reals, got {expected}")
            elif answer["kind"] == "value":
                got = sp.Rational(int(answer["n"]), int(answer["d"]))
                if sp.simplify(branches(problem["expr"])[0] - got) != 0:
                    failures.append(f"{cid}: value mismatch")
            else:
                failures.append(f"{cid}: unchecked answer {answer['kind']}")

            for i, step in enumerate(case["steps"]):
                if step["before"]["kind"] == "expr":
                    continue
                before = state_set(step["before"], x)
                after = state_set(step["after"], x)
                if before is None or after is None:
                    failures.append(f"{cid} step {i}: missing set")
                elif not same_set(before, after):
                    failures.append(
                        f"{cid} step {i} ({step['rule']}): solution set {before} -> {after}"
                    )
        except Exception as exc:  # noqa: BLE001 - report and keep going
            failures.append(f"{cid}: {type(exc).__name__}: {exc}")

    print(f"oracle: {len(data['cases'])} cases, {len(failures)} failures")
    if failures:
        for line in failures[:30]:
            print(line)
        sys.exit(1)
    print("oracle: all checks passed")


if __name__ == "__main__":
    main()
