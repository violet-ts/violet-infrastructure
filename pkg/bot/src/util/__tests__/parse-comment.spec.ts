import { parseComment, parseDirective } from '../parse-comment';

describe('parseComment', () => {
  it('should parse comments for the bot', () => {
    expect(
      parseComment(
        [
          "hi! I'm calling my bot.",
          '/foo  bar',
          'And once again!',
          '/hello',
          'not related!',
          '@me hello',
          '  /hello',
        ].join('\n'),
        '/',
      ),
    ).toEqual([{ args: ['foo', 'bar'] }, { args: ['hello'] }]);
  });
  it('should ignore the comments marked as ignore', () => {
    expect(parseComment(['<!-- violet: ignore -->', '/foo  bar'].join('\n'), '/')).toEqual([]);
  });
});

describe('parseDirective', () => {
  it('should parse bot specific directive', () => {
    expect(parseDirective('')).toBe(null);
    expect(parseDirective('<!-- -->')).toBe(null);
    expect(parseDirective('violet: hi')).toBe(null);
    expect(parseDirective('<!--violet: hi-->')).toBe('hi');
    expect(parseDirective(' <!-- violet: hi hello -->')).toBe('hi hello');
  });
});
