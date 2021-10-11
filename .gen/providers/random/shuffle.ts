// https://www.terraform.io/docs/providers/random/r/shuffle.html
// generated from terraform resource schema

import { Construct } from 'constructs';
import * as cdktf from 'cdktf';

// Configuration

export interface ShuffleConfig extends cdktf.TerraformMetaArguments {
  /**
  * The list of strings to shuffle.
  * 
  * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/random/r/shuffle.html#input Shuffle#input}
  */
  readonly input: string[];
  /**
  * Arbitrary map of values that, when changed, will trigger recreation of resource. See [the main provider documentation](../index.html) for more information.
  * 
  * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/random/r/shuffle.html#keepers Shuffle#keepers}
  */
  readonly keepers?: { [key: string]: string } | cdktf.IResolvable;
  /**
  * The number of results to return. Defaults to the number of items in the `input` list. If fewer items are requested, some elements will be excluded from the result. If more items are requested, items will be repeated in the result but not more frequently than the number of items in the input list.
  * 
  * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/random/r/shuffle.html#result_count Shuffle#result_count}
  */
  readonly resultCount?: number;
  /**
  * Arbitrary string with which to seed the random number generator, in order to produce less-volatile permutations of the list.

**Important:** Even with an identical seed, it is not guaranteed that the same permutation will be produced across different versions of Terraform. This argument causes the result to be *less volatile*, but not fixed for all time.
  * 
  * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/random/r/shuffle.html#seed Shuffle#seed}
  */
  readonly seed?: string;
}

/**
* Represents a {@link https://www.terraform.io/docs/providers/random/r/shuffle.html random_shuffle}
*/
export class Shuffle extends cdktf.TerraformResource {

  // =================
  // STATIC PROPERTIES
  // =================
  public static readonly tfResourceType: string = "random_shuffle";

  // ===========
  // INITIALIZER
  // ===========

  /**
  * Create a new {@link https://www.terraform.io/docs/providers/random/r/shuffle.html random_shuffle} Resource
  *
  * @param scope The scope in which to define this construct
  * @param id The scoped construct ID. Must be unique amongst siblings in the same scope
  * @param options ShuffleConfig
  */
  public constructor(scope: Construct, id: string, config: ShuffleConfig) {
    super(scope, id, {
      terraformResourceType: 'random_shuffle',
      terraformGeneratorMetadata: {
        providerName: 'random'
      },
      provider: config.provider,
      dependsOn: config.dependsOn,
      count: config.count,
      lifecycle: config.lifecycle
    });
    this._input = config.input;
    this._keepers = config.keepers;
    this._resultCount = config.resultCount;
    this._seed = config.seed;
  }

  // ==========
  // ATTRIBUTES
  // ==========

  // id - computed: true, optional: false, required: false
  public get id() {
    return this.getStringAttribute('id');
  }

  // input - computed: false, optional: false, required: true
  private _input: string[];
  public get input() {
    return this.getListAttribute('input');
  }
  public set input(value: string[]) {
    this._input = value;
  }
  // Temporarily expose input value. Use with caution.
  public get inputInput() {
    return this._input
  }

  // keepers - computed: false, optional: true, required: false
  private _keepers?: { [key: string]: string } | cdktf.IResolvable;
  public get keepers() {
    return this.interpolationForAttribute('keepers') as any;
  }
  public set keepers(value: { [key: string]: string } | cdktf.IResolvable ) {
    this._keepers = value;
  }
  public resetKeepers() {
    this._keepers = undefined;
  }
  // Temporarily expose input value. Use with caution.
  public get keepersInput() {
    return this._keepers
  }

  // result - computed: true, optional: false, required: false
  public get result() {
    return this.getListAttribute('result');
  }

  // result_count - computed: false, optional: true, required: false
  private _resultCount?: number;
  public get resultCount() {
    return this.getNumberAttribute('result_count');
  }
  public set resultCount(value: number ) {
    this._resultCount = value;
  }
  public resetResultCount() {
    this._resultCount = undefined;
  }
  // Temporarily expose input value. Use with caution.
  public get resultCountInput() {
    return this._resultCount
  }

  // seed - computed: false, optional: true, required: false
  private _seed?: string;
  public get seed() {
    return this.getStringAttribute('seed');
  }
  public set seed(value: string ) {
    this._seed = value;
  }
  public resetSeed() {
    this._seed = undefined;
  }
  // Temporarily expose input value. Use with caution.
  public get seedInput() {
    return this._seed
  }

  // =========
  // SYNTHESIS
  // =========

  protected synthesizeAttributes(): { [name: string]: any } {
    return {
      input: cdktf.listMapper(cdktf.stringToTerraform)(this._input),
      keepers: cdktf.hashMapper(cdktf.anyToTerraform)(this._keepers),
      result_count: cdktf.numberToTerraform(this._resultCount),
      seed: cdktf.stringToTerraform(this._seed),
    };
  }
}
