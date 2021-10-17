// https://www.terraform.io/docs/providers/random/r/integer.html
// generated from terraform resource schema

import { Construct } from 'constructs';
import * as cdktf from 'cdktf';

// Configuration

export interface IntegerConfig extends cdktf.TerraformMetaArguments {
  /**
  * Arbitrary map of values that, when changed, will trigger recreation of resource. See [the main provider documentation](../index.html) for more information.
  * 
  * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/random/r/integer.html#keepers Integer#keepers}
  */
  readonly keepers?: { [key: string]: string } | cdktf.IResolvable;
  /**
  * The maximum inclusive value of the range.
  * 
  * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/random/r/integer.html#max Integer#max}
  */
  readonly max: number;
  /**
  * The minimum inclusive value of the range.
  * 
  * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/random/r/integer.html#min Integer#min}
  */
  readonly min: number;
  /**
  * A custom seed to always produce the same value.
  * 
  * Docs at Terraform Registry: {@link https://www.terraform.io/docs/providers/random/r/integer.html#seed Integer#seed}
  */
  readonly seed?: string;
}

/**
* Represents a {@link https://www.terraform.io/docs/providers/random/r/integer.html random_integer}
*/
export class Integer extends cdktf.TerraformResource {

  // =================
  // STATIC PROPERTIES
  // =================
  public static readonly tfResourceType: string = "random_integer";

  // ===========
  // INITIALIZER
  // ===========

  /**
  * Create a new {@link https://www.terraform.io/docs/providers/random/r/integer.html random_integer} Resource
  *
  * @param scope The scope in which to define this construct
  * @param id The scoped construct ID. Must be unique amongst siblings in the same scope
  * @param options IntegerConfig
  */
  public constructor(scope: Construct, id: string, config: IntegerConfig) {
    super(scope, id, {
      terraformResourceType: 'random_integer',
      terraformGeneratorMetadata: {
        providerName: 'random'
      },
      provider: config.provider,
      dependsOn: config.dependsOn,
      count: config.count,
      lifecycle: config.lifecycle
    });
    this._keepers = config.keepers;
    this._max = config.max;
    this._min = config.min;
    this._seed = config.seed;
  }

  // ==========
  // ATTRIBUTES
  // ==========

  // id - computed: true, optional: false, required: false
  public get id() {
    return this.getStringAttribute('id');
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

  // max - computed: false, optional: false, required: true
  private _max: number;
  public get max() {
    return this.getNumberAttribute('max');
  }
  public set max(value: number) {
    this._max = value;
  }
  // Temporarily expose input value. Use with caution.
  public get maxInput() {
    return this._max
  }

  // min - computed: false, optional: false, required: true
  private _min: number;
  public get min() {
    return this.getNumberAttribute('min');
  }
  public set min(value: number) {
    this._min = value;
  }
  // Temporarily expose input value. Use with caution.
  public get minInput() {
    return this._min
  }

  // result - computed: true, optional: false, required: false
  public get result() {
    return this.getNumberAttribute('result');
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
      keepers: cdktf.hashMapper(cdktf.anyToTerraform)(this._keepers),
      max: cdktf.numberToTerraform(this._max),
      min: cdktf.numberToTerraform(this._min),
      seed: cdktf.stringToTerraform(this._seed),
    };
  }
}
