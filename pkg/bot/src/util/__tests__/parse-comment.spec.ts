import { parseComment, parseDirective } from '../parse-comment';

describe('parseComment', () => {
  it('should parse comments for the bot', () => {
    expect(
      parseComment(
        `
      hi! I'm calling my bot.
      @my-bot foo  bar
      And once again!
      @my-bot hello
      not related!
      @me hello
      @my-bot-foo hello
      `,
        'my-bot',
      ),
    ).toEqual([{ args: ['foo', 'bar'] }, { args: ['hello'] }]);
  });
  it('should ignore the comments marked as ignore', () => {
    expect(
      parseComment(
        `<!-- violet: ignore -->
      @my-bot foo  bar
      `,
        'my-bot',
      ),
    ).toEqual([]);
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
