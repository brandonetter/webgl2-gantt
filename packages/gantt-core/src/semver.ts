export type Semver = {
  major: number;
  minor: number;
  patch: number;
};

function parsePart(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid semver part: ${value}`);
  }
  return Number(value);
}

export function parseSemver(input: string): Semver {
  const normalized = input.trim();
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) {
    throw new Error(`Invalid semver: ${input}`);
  }

  return {
    major: parsePart(match[1]),
    minor: parsePart(match[2]),
    patch: parsePart(match[3]),
  };
}

export function compareSemver(left: Semver, right: Semver): number {
  if (left.major !== right.major) {
    return left.major - right.major;
  }
  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }
  return left.patch - right.patch;
}

function checkComparator(version: Semver, comparator: string): boolean {
  if (comparator === '*' || comparator.length === 0) {
    return true;
  }

  const operatorMatch = comparator.match(/^(<=|>=|<|>|=|\^|~)?\s*(\d+\.\d+\.\d+)$/);
  if (!operatorMatch) {
    throw new Error(`Unsupported semver comparator: ${comparator}`);
  }

  const operator = operatorMatch[1] ?? '=';
  const target = parseSemver(operatorMatch[2]);
  const cmp = compareSemver(version, target);

  switch (operator) {
    case '=':
      return cmp === 0;
    case '>':
      return cmp > 0;
    case '>=':
      return cmp >= 0;
    case '<':
      return cmp < 0;
    case '<=':
      return cmp <= 0;
    case '^': {
      const upper: Semver = { major: target.major + 1, minor: 0, patch: 0 };
      return cmp >= 0 && compareSemver(version, upper) < 0;
    }
    case '~': {
      const upper: Semver = { major: target.major, minor: target.minor + 1, patch: 0 };
      return cmp >= 0 && compareSemver(version, upper) < 0;
    }
    default:
      return false;
  }
}

export function satisfiesSemverRange(versionText: string, rangeText: string): boolean {
  const version = parseSemver(versionText);
  const range = rangeText.trim();
  if (range.length === 0 || range === '*') {
    return true;
  }

  const disjuncts = range.split('||').map((part) => part.trim()).filter((part) => part.length > 0);
  if (disjuncts.length === 0) {
    return true;
  }

  return disjuncts.some((disjunct) => {
    const comparators = disjunct.split(/\s+/).filter((token) => token.length > 0);
    return comparators.every((comparator) => checkComparator(version, comparator));
  });
}
