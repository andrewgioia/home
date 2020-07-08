# Homepage v7

This is version 7 of my homepage, now much simpler and without JS :P

The goal was to make it as light as possible, without any JavaScript, using system defaults and CSS variables for automatic light/dark mode support. I also wanted it to scale perfectly no matter what device or screen you're on.

![Screenshot as of July 2020](https://i.imgur.com/kqvVGde.png)

It's just a virtual business card but by all means fork/use the theme, just share in kind and refer back.

## Quick note on building

I'm using NPM to build for development and production and there are some basic commands in `package.json` for this. Make sure to `npm install`, then run `npm run dev` to generate the public files in `dist`. There should be a few asset folders and then `index.html` and `site.css` in the root there.

## Todo

Add some kind of minify support into the build process.
