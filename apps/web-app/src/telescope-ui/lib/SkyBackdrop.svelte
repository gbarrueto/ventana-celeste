<script module>
  // Decorative star field behind the connect and finder views. New in the
  // redesign — no equivalent in the source, purely ornamental.
  const STARS = [
    [12, 18, 1.4], [28, 9, 1], [41, 24, 1.8], [58, 13, 1.1], [72, 27, 2.2], [86, 16, 1.3],
    [8, 44, 1], [22, 55, 1.6], [37, 47, 1.1], [52, 62, 2.6], [66, 51, 1.2], [79, 66, 1.5],
    [92, 49, 1], [17, 78, 1.3], [33, 86, 1], [48, 74, 1.7], [63, 88, 1.2], [77, 80, 2],
    [90, 72, 1.1], [5, 30, 1.2], [45, 36, 1], [70, 40, 1.4],
  ];
</script>

<script>
  let { dense = false, style = '' } = $props();
</script>

<div class="vc-sky" style={style}>
  <div class="vc-sky-gradient vc-sky-grad" style="opacity:{dense ? 1 : 0.55}"></div>
  {#each STARS as [x, y, r], i (i)}
    <span
      class="vc-star"
      style="
        left:{x}%; top:{y}%; width:{r * 2}px; height:{r * 2}px;
        background:{i % 7 === 0 ? 'var(--stella)' : '#FFF8E1'};
        opacity:{0.25 + (r / 3) * 0.6};
        box-shadow:{i % 7 === 0 ? 'var(--glow-star)' : 'none'};
        animation-duration:{2 + (i % 5)}s;
      "
    ></span>
  {/each}
</div>

<style>
  .vc-sky {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .vc-sky-grad {
    position: absolute;
    inset: 0;
  }
  .vc-star {
    position: absolute;
    border-radius: 50%;
    animation-name: vc-twinkle;
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
  }
</style>
